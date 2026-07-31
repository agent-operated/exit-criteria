import type { Criterion } from "../domain/criteria.js";
import type { ConditionResult } from "../domain/outcome.js";
import { runCheck, type CheckRun } from "../infrastructure/run-check.js";

export type CheckRunner = (
  criterion: Criterion,
  repoRoot: string,
) => Promise<CheckRun>;

const defaultRunner: CheckRunner = runCheck;

/**
 * Evaluates every declared criterion. A criterion is never dropped from the
 * report, including when its command cannot be run.
 */
export async function evaluate(
  criteria: readonly Criterion[],
  repoRoot: string,
  runner: CheckRunner = defaultRunner,
): Promise<readonly ConditionResult[]> {
  const results: ConditionResult[] = [];
  for (const criterion of criteria) {
    results.push(await evaluateOne(criterion, repoRoot, runner));
  }
  return results;
}

async function evaluateOne(
  criterion: Criterion,
  repoRoot: string,
  runner: CheckRunner,
): Promise<ConditionResult> {
  const base = { conditionId: criterion.id, text: criterion.text };
  const run = await runner(criterion, repoRoot);
  if (run.kind === "unavailable") {
    return { ...base, outcome: "UNAVAILABLE", unavailableReason: run.reason };
  }
  return {
    ...base,
    outcome: run.exitCode === 0 ? "PASS" : "FAIL",
    exitCode: run.exitCode,
  };
}
