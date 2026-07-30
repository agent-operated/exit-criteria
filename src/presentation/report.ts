import type { ConditionResult, Outcome } from "../domain/outcome.js";

export type RunUnavailableReason = "config_unavailable" | "invalid_config";

export interface Report {
  readonly configDigest?: string;
  readonly results: readonly ConditionResult[];
  readonly runOutcome: Outcome;
  readonly unavailableReason?: RunUnavailableReason;
  readonly message?: string;
}

export function formatText(report: Report): string {
  const lines: string[] = [];
  if (report.configDigest !== undefined) {
    lines.push(`config: ${report.configDigest}`);
  }
  if (report.results.length === 0) {
    lines.push("no criteria were evaluated");
  }
  for (const result of report.results) {
    const suffix =
      result.outcome === "UNAVAILABLE"
        ? `  (${result.unavailableReason ?? "unknown"})`
        : result.exitCode !== undefined
          ? `  (exit ${result.exitCode})`
          : "";
    lines.push(`${result.outcome.padEnd(11)} ${result.conditionId}${suffix}`);
    lines.push(`            ${result.text}`);
  }
  if (report.unavailableReason !== undefined) {
    lines.push(`reason: ${report.unavailableReason}`);
  }
  if (report.message !== undefined) {
    lines.push(`message: ${report.message}`);
  }
  lines.push("");
  lines.push(`run: ${report.runOutcome}`);
  return lines.join("\n");
}

export function formatJson(report: Report): string {
  return JSON.stringify(
    {
      tool: "exit-criteria",
      report_version: 1,
      ...(report.configDigest === undefined ? {} : { config_digest: report.configDigest }),
      run_outcome: report.runOutcome,
      conditions: report.results.map((result) => ({
        condition_id: result.conditionId,
        text: result.text,
        outcome: result.outcome,
        ...(result.unavailableReason === undefined
          ? {}
          : { unavailable_reason: result.unavailableReason }),
        ...(result.exitCode === undefined ? {} : { exit_code: result.exitCode }),
      })),
      ...(report.unavailableReason === undefined
        ? {}
        : { unavailable_reason: report.unavailableReason }),
      ...(report.message === undefined ? {} : { message: report.message }),
    },
    null,
    2,
  );
}
