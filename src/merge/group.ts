import { createHash } from "node:crypto";
import type { NormalizedFact } from "../schemas/raw-fact.js";

export interface CandidateFactGroup {
  /** sha256(matchKey) — deterministic for a given matchKey string */
  candidateId: string;
  /** e.g. "email:foo@bar.com", "name+company:...", or "standalone:..." */
  matchKey: string;
  facts: NormalizedFact[];
}

function bundleKey(fact: NormalizedFact): string {
  return `${fact.source}:${fact.rowIndex}`;
}

function normalizeKeyPart(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getStringValue(facts: NormalizedFact[], field: string): string | undefined {
  for (const fact of facts) {
    if (fact.field !== field) {
      continue;
    }

    if (
      fact.normalizationSucceeded &&
      typeof fact.normalizedValue === "string"
    ) {
      const trimmed = fact.normalizedValue.trim();
      if (trimmed !== "") {
        return trimmed;
      }
    }

    if (typeof fact.rawValue === "string") {
      const trimmed = fact.rawValue.trim();
      if (trimmed !== "") {
        return trimmed;
      }
    }
  }

  return undefined;
}

function normalizedName(facts: NormalizedFact[]): string | undefined {
  const name = getStringValue(facts, "full_name");
  return name === undefined ? undefined : normalizeKeyPart(name);
}

export function computeMatchKey(facts: NormalizedFact[]): string | null {
  const emails = facts
    .filter((fact) => fact.field === "emails")
    .map((fact) => {
      if (
        fact.normalizationSucceeded &&
        typeof fact.normalizedValue === "string"
      ) {
        return normalizeKeyPart(fact.normalizedValue);
      }
      if (typeof fact.rawValue === "string") {
        return normalizeKeyPart(fact.rawValue);
      }
      return null;
    })
    .filter((email): email is string => email !== null && email !== "");

  const distinctEmails = new Set(emails);
  if (distinctEmails.size > 1) {
    return null;
  }
  if (distinctEmails.size === 1) {
    return `email:${[...distinctEmails][0]}`;
  }

  const name = getStringValue(facts, "full_name");
  const company = getStringValue(facts, "experience.company");
  if (name !== undefined && company !== undefined) {
    return `name+company:${normalizeKeyPart(name)}|${normalizeKeyPart(company)}`;
  }

  return null;
}

function provisionalBundles(facts: NormalizedFact[]): NormalizedFact[][] {
  const byKey = new Map<string, NormalizedFact[]>();

  for (const fact of facts) {
    const key = bundleKey(fact);
    const bucket = byKey.get(key);
    if (bucket === undefined) {
      byKey.set(key, [fact]);
    } else {
      bucket.push(fact);
    }
  }

  return [...byKey.values()];
}

function canUnionCrossSource(
  csvFacts: NormalizedFact[],
  githubFacts: NormalizedFact[],
): boolean {
  const csvKey = computeMatchKey(csvFacts);
  if (csvKey === null) {
    return false;
  }

  const unionFacts = [...csvFacts, ...githubFacts];
  if (computeMatchKey(unionFacts) !== csvKey) {
    return false;
  }

  const csvName = normalizedName(csvFacts);
  const githubName = normalizedName(githubFacts);
  if (
    csvName !== undefined &&
    githubName !== undefined &&
    csvName !== githubName
  ) {
    return false;
  }

  return true;
}

function unionCrossSource(bundles: NormalizedFact[][]): NormalizedFact[][] {
  const csvBundles = bundles.filter((bundle) => bundle[0]?.source === "csv");
  const githubBundles = bundles.filter((bundle) => bundle[0]?.source === "github");
  const otherBundles = bundles.filter(
    (bundle) =>
      bundle.length > 0 &&
      bundle[0]?.source !== "csv" &&
      bundle[0]?.source !== "github",
  );

  const usedGithub = new Set<number>();
  const result: NormalizedFact[][] = [...otherBundles];

  for (const csvBundle of csvBundles) {
    let matched = false;

    for (let index = 0; index < githubBundles.length; index++) {
      if (usedGithub.has(index)) {
        continue;
      }

      if (canUnionCrossSource(csvBundle, githubBundles[index])) {
        result.push([...csvBundle, ...githubBundles[index]]);
        usedGithub.add(index);
        matched = true;
        break;
      }
    }

    if (!matched) {
      result.push(csvBundle);
    }
  }

  for (let index = 0; index < githubBundles.length; index++) {
    if (!usedGithub.has(index)) {
      result.push(githubBundles[index]);
    }
  }

  return result;
}

function standaloneMatchKey(facts: NormalizedFact[]): string {
  const fingerprint = facts
    .map((fact) =>
      JSON.stringify({
        field: fact.field,
        source: fact.source,
        sourceMethod: fact.sourceMethod,
        rawValue: fact.rawValue,
      }),
    )
    .sort()
    .join("|");

  const fingerprintHash = createHash("sha256").update(fingerprint).digest("hex");
  return `standalone:${fingerprintHash}`;
}

function candidateIdFromMatchKey(matchKey: string): string {
  return createHash("sha256").update(matchKey).digest("hex");
}

function resolveMatchKey(facts: NormalizedFact[]): string {
  return computeMatchKey(facts) ?? standaloneMatchKey(facts);
}

export function groupFactsByCandidate(
  facts: NormalizedFact[],
): CandidateFactGroup[] {
  const mergedBundles = unionCrossSource(provisionalBundles(facts));
  const groupsByMatchKey = new Map<string, NormalizedFact[]>();

  for (const bundle of mergedBundles) {
    const matchKey = resolveMatchKey(bundle);
    const existing = groupsByMatchKey.get(matchKey);
    if (existing === undefined) {
      groupsByMatchKey.set(matchKey, [...bundle]);
    } else {
      existing.push(...bundle);
    }
  }

  return [...groupsByMatchKey.entries()].map(([matchKey, groupFacts]) => ({
    candidateId: candidateIdFromMatchKey(matchKey),
    matchKey,
    facts: groupFacts,
  }));
}
