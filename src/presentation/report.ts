import type { ConditionResult, Outcome } from "../domain/outcome.js";

export interface Report {
  readonly issue: string;
  readonly results: readonly ConditionResult[];
  readonly runOutcome: Outcome;
  readonly statusDetail?: string;
}

export function formatText(report: Report): string {
  const lines: string[] = [];
  lines.push(`issue: ${report.issue}`);
  if (report.results.length === 0) {
    lines.push(`no conditions were evaluated`);
    if (report.statusDetail !== undefined) {
      lines.push(`reason: ${report.statusDetail}`);
    }
  }
  for (const r of report.results) {
    const suffix =
      r.outcome === "UNAVAILABLE"
        ? `  (${r.unavailableReason ?? "unknown"})`
        : r.exitCode !== undefined
          ? `  (exit ${r.exitCode})`
          : "";
    lines.push(`${r.outcome.padEnd(11)} ${r.conditionId}${suffix}`);
  }
  lines.push("");
  lines.push(`run: ${report.runOutcome}`);
  lines.push(`this result covers only the conditions listed above`);
  return lines.join("\n");
}

export function formatJson(report: Report): string {
  return JSON.stringify(
    {
      tool: "exit-criteria",
      issue: report.issue,
      run_outcome: report.runOutcome,
      conditions: report.results.map((r) => ({
        condition_id: r.conditionId,
        outcome: r.outcome,
        evidence_kind: r.evidenceKind,
        ...(r.unavailableReason === undefined ? {} : { unavailable_reason: r.unavailableReason }),
        ...(r.exitCode === undefined ? {} : { exit_code: r.exitCode }),
      })),
      authority: "none",
    },
    null,
    2,
  );
}
