/**
 * Three outcomes, never two.
 *
 * A check that could not acquire its input is not a check that passed, and it is
 * not a check that failed either. Collapsing UNAVAILABLE into PASS is the defect
 * this vocabulary exists to prevent.
 */
export type Outcome = "PASS" | "FAIL" | "UNAVAILABLE";

/** Why a criterion ended up UNAVAILABLE. Closed vocabulary; no free text. */
export type UnavailableReason =
  | "spawn_failed"
  | "terminated_by_signal"
  | "timeout";

export interface CriterionResult {
  readonly criterionId: string;
  readonly text: string;
  readonly outcome: Outcome;
  /** Present only when outcome is UNAVAILABLE. */
  readonly unavailableReason?: UnavailableReason;
  /** Present only when a command actually ran to completion. */
  readonly exitCode?: number;
}

/**
 * A run passes only when every criterion passed. UNAVAILABLE never counts
 * toward success — an unknown is not a yes.
 */
export function runOutcome(results: readonly CriterionResult[]): Outcome {
  if (results.length === 0) {
    return "UNAVAILABLE";
  }
  if (results.some((r) => r.outcome === "UNAVAILABLE")) {
    return "UNAVAILABLE";
  }
  if (results.some((r) => r.outcome === "FAIL")) {
    return "FAIL";
  }
  return "PASS";
}

export function exitCodeFor(outcome: Outcome): 0 | 1 | 2 {
  switch (outcome) {
    case "PASS":
      return 0;
    case "FAIL":
      return 1;
    case "UNAVAILABLE":
      return 2;
  }
}
