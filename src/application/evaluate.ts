import type { BindingSet } from "../domain/bindings.js";
import type { ConditionResult } from "../domain/outcome.js";
import type { ConditionsResult, ProjectedCondition } from "../infrastructure/gtp.js";
import { runCheck, type CheckRun } from "../infrastructure/run-check.js";

export type CheckRunner = (
  conditionId: string,
  bindings: BindingSet,
  repoRoot: string,
) => Promise<CheckRun | undefined>;

const defaultRunner: CheckRunner = async (conditionId, bindings, repoRoot) => {
  const binding = bindings.checks.get(conditionId);
  if (binding === undefined) {
    return undefined;
  }
  return runCheck(binding, repoRoot);
};

/**
 * Evaluates every condition GTP projected.
 *
 * Conditions are never dropped. A condition with no binding is reported as
 * UNAVAILABLE rather than skipped, because a skipped condition disappears from
 * the report and a disappeared condition looks like one that passed.
 */
export async function evaluate(
  conditions: ConditionsResult,
  bindings: BindingSet,
  repoRoot: string,
  runner: CheckRunner = defaultRunner,
): Promise<readonly ConditionResult[]> {
  if (conditions.kind === "unavailable") {
    return [];
  }
  const results: ConditionResult[] = [];
  for (const condition of conditions.conditions) {
    results.push(await evaluateOne(condition, bindings, repoRoot, runner));
  }
  return results;
}

async function evaluateOne(
  condition: ProjectedCondition,
  bindings: BindingSet,
  repoRoot: string,
  runner: CheckRunner,
): Promise<ConditionResult> {
  const base = { conditionId: condition.conditionId, evidenceKind: condition.evidenceKind };

  if (condition.evidenceKind !== "check") {
    // artifact evidence is out of scope for this slice. Saying so is not the
    // same as passing it.
    return { ...base, outcome: "UNAVAILABLE", unavailableReason: "no_binding" };
  }

  const run = await runner(condition.conditionId, bindings, repoRoot);
  if (run === undefined) {
    return { ...base, outcome: "UNAVAILABLE", unavailableReason: "no_binding" };
  }
  if (run.kind === "unavailable") {
    return { ...base, outcome: "UNAVAILABLE", unavailableReason: run.reason };
  }
  return {
    ...base,
    outcome: run.exitCode === 0 ? "PASS" : "FAIL",
    exitCode: run.exitCode,
  };
}
