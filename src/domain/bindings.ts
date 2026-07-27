import { parse } from "yaml";

/**
 * A binding says how one condition id is checked. It never says whether the
 * condition holds — that is decided by running the command.
 */
export interface Binding {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly timeoutSeconds: number;
}

export interface BindingSet {
  readonly issue: string;
  readonly checks: ReadonlyMap<string, Binding>;
}

export class BindingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BindingError";
  }
}

const DEFAULT_TIMEOUT_SECONDS = 300;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Commands are argv arrays, never shell strings. A shell string would let the
 * contents of a file decide what runs.
 */
function parseBinding(conditionId: string, raw: unknown): Binding {
  if (!isRecord(raw)) {
    throw new BindingError(`check "${conditionId}" must be a mapping`);
  }
  const argv = raw["argv"];
  if (!Array.isArray(argv) || argv.length === 0) {
    throw new BindingError(`check "${conditionId}" must declare a non-empty argv array`);
  }
  if (!argv.every((a): a is string => typeof a === "string")) {
    throw new BindingError(`check "${conditionId}" argv must contain only strings`);
  }
  const cwd = raw["cwd"] ?? ".";
  if (typeof cwd !== "string") {
    throw new BindingError(`check "${conditionId}" cwd must be a string`);
  }
  if (cwd.startsWith("/")) {
    throw new BindingError(`check "${conditionId}" cwd must be relative to the repository root`);
  }
  const timeout = raw["timeout_seconds"] ?? DEFAULT_TIMEOUT_SECONDS;
  if (typeof timeout !== "number" || !Number.isFinite(timeout) || timeout <= 0) {
    throw new BindingError(`check "${conditionId}" timeout_seconds must be a positive number`);
  }
  return { argv, cwd, timeoutSeconds: timeout };
}

export function parseBindings(source: string): BindingSet {
  const doc: unknown = parse(source);
  if (!isRecord(doc)) {
    throw new BindingError("binding file must be a mapping");
  }
  if (doc["version"] !== 1) {
    throw new BindingError("binding file must declare version: 1");
  }
  const issue = doc["issue"];
  if (typeof issue !== "string" || issue === "") {
    throw new BindingError("binding file must declare the issue URL it belongs to");
  }
  const checks = doc["checks"];
  if (!isRecord(checks)) {
    throw new BindingError("binding file must declare a checks mapping");
  }
  const map = new Map<string, Binding>();
  for (const [conditionId, raw] of Object.entries(checks)) {
    map.set(conditionId, parseBinding(conditionId, raw));
  }
  return { issue, checks: map };
}
