import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

/**
 * Real wiring, end to end. The built CLI runs as a child process, reads the
 * done_conditions from the actual GTP Contract on the issue, and runs bound
 * checks for real.
 *
 * Fixture bindings are used on purpose. Binding the real checks here would make
 * this test invoke the CLI, which would invoke this test again.
 */
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");
const cli = resolve(repoRoot, "dist", "src", "cli.js");

const ISSUE = "https://github.com/agent-operated/exit-criteria/issues/2";
const EXPECTED_CONDITIONS = [
  "binding_required",
  "decision_has_no_model",
  "end_to_end",
  "unavailable_is_not_pass",
];

interface CliRun {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function runCli(): CliRun {
  const result = spawnSync(
    process.execPath,
    [cli, "--issue", ISSUE, "--bindings", "test/fixtures/bindings.yml", "--repo-root", repoRoot, "--json"],
    { encoding: "utf8", shell: false, timeout: 300_000 },
  );
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

interface CliReport {
  issue: string;
  run_outcome: string;
  authority: string;
  conditions: {
    condition_id: string;
    outcome: string;
    unavailable_reason?: string;
    exit_code?: number;
  }[];
}

/**
 * A test that could not reach its subject must not pass.
 *
 * When GitHub cannot be read, the CLI correctly reports every condition as
 * UNAVAILABLE — but that says nothing about whether the wiring works, so this
 * test has to fail rather than report a green it did not earn. The message
 * distinguishes "the wiring is broken" from "we never got to look at it".
 */
function reportOrFail(run: CliRun): CliReport {
  assert.notEqual(
    run.stdout.trim(),
    "",
    `the CLI produced no output. stderr: ${run.stderr}`,
  );
  const report = JSON.parse(run.stdout) as CliReport;
  if (report.conditions.length === 0) {
    assert.fail(
      "the conditions could not be acquired from GitHub, so the wiring was never exercised. " +
        "This is not a failure of the code under test. Check that the GTP CLI is reachable " +
        "(GTP_BIN or PATH) and that the API is not rate limited — an anonymous read is capped " +
        "at 60 requests per hour, so set GITHUB_TOKEN to a read-only token.",
    );
  }
  return report;
}

test("the built CLI reads the issue's real done_conditions and reports every one", () => {
  const report = reportOrFail(runCli());

  assert.equal(report.issue, ISSUE);
  assert.equal(report.authority, "none", "this tool grants no authority");

  const ids = report.conditions.map((c) => c.condition_id).sort();
  assert.deepEqual(ids, EXPECTED_CONDITIONS, "every condition frozen in the GTP Contract must appear");
});

test("outcomes follow the bound commands, and unbound conditions stay UNAVAILABLE", () => {
  const report = reportOrFail(runCli());
  const byId = new Map(report.conditions.map((c) => [c.condition_id, c]));

  // exits 0 in the fixture
  assert.equal(byId.get("end_to_end")?.outcome, "PASS");
  assert.equal(byId.get("end_to_end")?.exit_code, 0);

  // exits 3 in the fixture
  assert.equal(byId.get("unavailable_is_not_pass")?.outcome, "FAIL");
  assert.equal(byId.get("unavailable_is_not_pass")?.exit_code, 3);

  // absent from the fixture
  for (const id of ["binding_required", "decision_has_no_model"]) {
    assert.equal(byId.get(id)?.outcome, "UNAVAILABLE", `${id} must not disappear`);
    assert.equal(byId.get(id)?.unavailable_reason, "no_binding");
  }
});

test("a run containing an unavailable condition does not exit zero", () => {
  const run = runCli();
  reportOrFail(run);
  assert.equal(run.status, 2, "UNAVAILABLE must not be reported as success");
});
