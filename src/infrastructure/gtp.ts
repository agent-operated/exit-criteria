import { spawn } from "node:child_process";

/**
 * One condition as GTP projects it. GTP owns the id, the text and the evidence
 * kind, and guarantees they cannot be redefined once the Contract is posted.
 * This project never writes them.
 */
export interface ProjectedCondition {
  readonly conditionId: string;
  readonly text: string;
  readonly evidenceKind: string;
}

export type ConditionsResult =
  | { readonly kind: "acquired"; readonly conditions: readonly ProjectedCondition[] }
  | { readonly kind: "unavailable"; readonly detail: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The machine JSON follows the human-facing section, so take the first object. */
export function extractMachineJson(stdout: string): unknown {
  const start = stdout.indexOf("{");
  if (start < 0) {
    throw new Error("no machine JSON found in gtp output");
  }
  return JSON.parse(stdout.slice(start));
}

export function conditionsFrom(projection: unknown): readonly ProjectedCondition[] {
  if (!isRecord(projection)) {
    throw new Error("gtp projection is not an object");
  }
  const taskContext = projection["task_context"];
  if (!isRecord(taskContext)) {
    throw new Error("gtp projection has no task_context");
  }
  const conditions = taskContext["conditions"];
  if (!isRecord(conditions)) {
    throw new Error("gtp projection has no task_context.conditions");
  }
  const out: ProjectedCondition[] = [];
  for (const [conditionId, raw] of Object.entries(conditions)) {
    if (!isRecord(raw)) {
      throw new Error(`condition "${conditionId}" is not an object`);
    }
    const text = raw["text"];
    const evidenceKind = raw["evidence_kind"];
    if (typeof text !== "string" || typeof evidenceKind !== "string") {
      throw new Error(`condition "${conditionId}" is missing text or evidence_kind`);
    }
    out.push({ conditionId, text, evidenceKind });
  }
  return out;
}

/**
 * Runs the real GTP CLI. Failure to acquire is reported as `unavailable`, never
 * as an empty condition list — an empty list would silently pass a run.
 */
export function readConditions(
  issueUrl: string,
  gtpBin: string,
  timeoutSeconds = 120,
): Promise<ConditionsResult> {
  return new Promise((resolve) => {
    const child = spawn(gtpBin, ["status", issueUrl], {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    let spawnError: Error | undefined;
    let timedOut = false;

    child.stdout.on("data", (c: Buffer) => stdout.push(c));
    child.stderr.on("data", () => {});
    child.on("error", (error) => {
      spawnError = error;
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutSeconds * 1000);
    timer.unref();

    child.on("close", (code) => {
      clearTimeout(timer);
      if (spawnError !== undefined) {
        resolve({ kind: "unavailable", detail: `gtp could not be started` });
        return;
      }
      if (timedOut) {
        resolve({ kind: "unavailable", detail: "gtp timed out" });
        return;
      }
      if (code !== 0) {
        resolve({ kind: "unavailable", detail: `gtp exited ${String(code)}` });
        return;
      }
      try {
        const conditions = conditionsFrom(extractMachineJson(Buffer.concat(stdout).toString("utf8")));
        resolve({ kind: "acquired", conditions });
      } catch (error) {
        resolve({
          kind: "unavailable",
          detail: error instanceof Error ? error.message : "unreadable gtp output",
        });
      }
    });
  });
}
