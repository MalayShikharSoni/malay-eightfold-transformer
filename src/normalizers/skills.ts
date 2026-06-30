const SKILL_SYNONYMS: Record<string, string> = {
  js: "JavaScript",
  javascript: "JavaScript",
  "java script": "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  node: "Node.js",
  nodejs: "Node.js",
  "node.js": "Node.js",
  py: "Python",
  python: "Python",
  postgres: "PostgreSQL",
  postgresql: "PostgreSQL",
};

function normalizeSkillKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeSkill(rawValue: unknown): string | null {
  if (typeof rawValue !== "string") {
    return null;
  }

  const trimmed = rawValue.trim();
  if (trimmed === "") {
    return null;
  }

  const canonical = SKILL_SYNONYMS[normalizeSkillKey(trimmed)];
  if (canonical !== undefined) {
    return canonical;
  }

  return trimmed;
}
