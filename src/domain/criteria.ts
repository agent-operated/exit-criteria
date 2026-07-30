import { createHash } from "node:crypto";
import { parse } from "yaml";

export interface Criterion {
  readonly id: string;
  readonly text: string;
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly timeoutSeconds: number;
}

export interface CriteriaConfig {
  readonly version: 1;
  readonly criteria: readonly Criterion[];
  readonly configDigest: string;
}

export class CriteriaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CriteriaError";
  }
}

const DEFAULT_TIMEOUT_SECONDS = 300;
const MAX_TIMEOUT_SECONDS = 2_147_483.647;
const TOP_LEVEL_KEYS = new Set(["version", "criteria"]);
const CRITERION_KEYS = new Set(["text", "argv", "cwd", "timeout_seconds"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  location: string,
): void {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new CriteriaError(`${location} contains unknown field "${unknown[0]}"`);
  }
}

function normalizeCwd(value: string, criterionId: string): string {
  const portable = value.replaceAll("\\", "/");
  if (portable.startsWith("/") || /^[A-Za-z]:/.test(portable)) {
    throw new CriteriaError(
      `criterion "${criterionId}" cwd must be relative to the repository root`,
    );
  }

  const segments: string[] = [];
  for (const segment of portable.split("/")) {
    if (segment === "" || segment === ".") {
      continue;
    }
    if (segment === "..") {
      if (segments.length === 0) {
        throw new CriteriaError(`criterion "${criterionId}" cwd escapes the repository root`);
      }
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.join("/") || ".";
}

function assertValidUnicode(value: string, location: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new CriteriaError(`${location} contains invalid Unicode`);
      }
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw new CriteriaError(`${location} contains invalid Unicode`);
    }
  }
}

function parseCriterion(id: string, raw: unknown): Criterion {
  assertValidUnicode(id, "criterion id");
  if (id.length === 0) {
    throw new CriteriaError("criterion id must not be empty");
  }
  if (!isRecord(raw)) {
    throw new CriteriaError(`criterion "${id}" must be a mapping`);
  }
  rejectUnknownKeys(raw, CRITERION_KEYS, `criterion "${id}"`);

  const text = raw["text"];
  if (typeof text !== "string" || text.trim() === "") {
    throw new CriteriaError(`criterion "${id}" must declare non-empty text`);
  }
  assertValidUnicode(text, `criterion "${id}" text`);

  const argv = raw["argv"];
  if (!Array.isArray(argv) || argv.length === 0) {
    throw new CriteriaError(`criterion "${id}" must declare a non-empty argv array`);
  }
  if (!argv.every((argument): argument is string => typeof argument === "string")) {
    throw new CriteriaError(`criterion "${id}" argv must contain only strings`);
  }
  argv.forEach((argument, index) => {
    assertValidUnicode(argument, `criterion "${id}" argv[${String(index)}]`);
  });

  const rawCwd = raw["cwd"] ?? ".";
  if (typeof rawCwd !== "string" || rawCwd === "") {
    throw new CriteriaError(`criterion "${id}" cwd must be a non-empty string`);
  }
  assertValidUnicode(rawCwd, `criterion "${id}" cwd`);
  const cwd = normalizeCwd(rawCwd, id);

  const timeout = raw["timeout_seconds"] ?? DEFAULT_TIMEOUT_SECONDS;
  if (typeof timeout !== "number" || !Number.isFinite(timeout) || timeout <= 0) {
    throw new CriteriaError(`criterion "${id}" timeout_seconds must be a positive number`);
  }
  if (timeout > MAX_TIMEOUT_SECONDS) {
    throw new CriteriaError(
      `criterion "${id}" timeout_seconds must not exceed ${String(MAX_TIMEOUT_SECONDS)}`,
    );
  }

  return { id, text, argv, cwd, timeoutSeconds: timeout };
}

function canonicalizeString(value: string): string {
  assertValidUnicode(value, "effective criteria");
  return JSON.stringify(value);
}

/** RFC 8785 JSON Canonicalization Scheme for this schema's JSON-compatible values. */
function canonicalize(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return canonicalizeString(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${canonicalizeString(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  }
  throw new CriteriaError("effective criteria contain a value that cannot be canonicalized");
}

function digestFor(criteria: readonly Criterion[]): string {
  const normalized = {
    version: 1,
    criteria: criteria.map((criterion) => ({
      id: criterion.id,
      text: criterion.text,
      argv: criterion.argv,
      cwd: criterion.cwd,
      timeout_seconds: criterion.timeoutSeconds,
    })),
  };
  const hex = createHash("sha256").update(canonicalize(normalized), "utf8").digest("hex");
  return `sha256:${hex}`;
}

export function parseCriteria(source: string): CriteriaConfig {
  let doc: unknown;
  try {
    doc = parse(source, { uniqueKeys: true });
  } catch (error) {
    throw new CriteriaError(
      `criteria file is not valid YAML: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!isRecord(doc)) {
    throw new CriteriaError("criteria file must be a mapping");
  }
  rejectUnknownKeys(doc, TOP_LEVEL_KEYS, "criteria file");
  if (doc["version"] !== 1) {
    throw new CriteriaError("criteria file must declare version: 1");
  }
  const rawCriteria = doc["criteria"];
  if (!isRecord(rawCriteria) || Object.keys(rawCriteria).length === 0) {
    throw new CriteriaError("criteria file must declare at least one criterion");
  }

  const criteria = Object.entries(rawCriteria)
    .map(([id, raw]) => parseCriterion(id, raw))
    .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));

  return { version: 1, criteria, configDigest: digestFor(criteria) };
}
