import type { NormalizedFact, RawFact } from "../schemas/raw-fact.js";
import { normalizePhone } from "./phone.js";
import { normalizeSkill } from "./skills.js";

type FieldNormalizer = (rawValue: unknown) => string | null;

/** Fields that run a dedicated normalizer. */
const NORMALIZER_BY_FIELD: Readonly<Record<string, FieldNormalizer>> = {
  phones: normalizePhone,
  skills: normalizeSkill,
};

/** Fields that intentionally skip normalization — value is used as-is. */
const PASSTHROUGH_FIELDS: ReadonlySet<string> = new Set([
  "full_name",
  "emails",
  "headline",
  "links.github",
  "links.portfolio",
  "experience.company",
  "experience.title",
]);

function normalizeFact(fact: RawFact): NormalizedFact {
  const normalizer = NORMALIZER_BY_FIELD[fact.field];

  if (normalizer !== undefined) {
    const normalizedValue = normalizer(fact.rawValue);
    return {
      ...fact,
      normalizedValue,
      normalizationSucceeded: normalizedValue !== null,
    };
  }

  if (PASSTHROUGH_FIELDS.has(fact.field)) {
    return {
      ...fact,
      normalizedValue: fact.rawValue,
      normalizationSucceeded: true,
    };
  }

  return {
    ...fact,
    normalizedValue: fact.rawValue,
    normalizationSucceeded: false,
  };
}

export function normalizeFacts(facts: RawFact[]): NormalizedFact[] {
  return facts.map(normalizeFact);
}
