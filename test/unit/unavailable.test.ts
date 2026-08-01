import assert from "node:assert/strict";
import test from "node:test";

import { evaluate } from "../../src/application/evaluate.js";
import { parseCriteria, type Criterion } from "../../src/domain/criteria.js";
import { runOutcome } from "../../src/domain/outcome.js";
import { runCheck } from "../../src/infrastructure/run-check.js";

const criterion = parseCriteria(`
version: 1
criteria:
  a:
    text: A
    argv: ["node", "-e", "process.exit(0)"]
`).criteria;

test("a command that cannot be started is UNAVAILABLE, not PASS and not FAIL", async () => {
  const results = await evaluate(criterion, process.cwd(), async () => ({
    kind: "unavailable",
    reason: "spawn_failed",
  }));

  assert.equal(results.length, 1);
  assert.equal(results[0]?.outcome, "UNAVAILABLE");
  assert.equal(results[0]?.unavailableReason, "spawn_failed");
  assert.notEqual(results[0]?.outcome, "PASS");
});

test("a timed out command is UNAVAILABLE", async () => {
  const results = await evaluate(criterion, process.cwd(), async () => ({
    kind: "unavailable",
    reason: "timeout",
  }));

  assert.equal(results[0]?.outcome, "UNAVAILABLE");
  assert.equal(results[0]?.unavailableReason, "timeout");
});

test("the real command runner enforces timeout_seconds", async () => {
  const timed: Criterion = {
    id: "slow",
    text: "The command finishes before its deadline",
    argv: [process.execPath, "-e", "setTimeout(() => {}, 2000)"],
    cwd: ".",
    timeoutSeconds: 0.2,
  };

  const started = performance.now();
  const result = await runCheck(timed, process.cwd());
  const elapsed = performance.now() - started;

  assert.deepEqual(result, {
    kind: "unavailable",
    reason: "timeout",
  });
  assert.ok(elapsed < 1_500, `timeout took ${String(elapsed)}ms`);
});

test("a command terminated by signal is UNAVAILABLE without a fake exit code", async () => {
  const signaled = parseCriteria(`
version: 1
criteria:
  signaled:
    text: The command exits normally
    argv: ["node", "-e", "process.kill(process.pid, 'SIGTERM')"]
`).criteria[0];
  assert.ok(signaled !== undefined);

  assert.deepEqual(await runCheck(signaled, process.cwd()), {
    kind: "unavailable",
    reason: "terminated_by_signal",
  });
});

test("an unavailable criterion makes the whole run UNAVAILABLE", () => {
  assert.equal(
    runOutcome([
      { criterionId: "a", text: "A", outcome: "PASS", exitCode: 0 },
      { criterionId: "b", text: "B", outcome: "UNAVAILABLE" },
    ]),
    "UNAVAILABLE",
  );
});

test("a run that evaluated nothing is UNAVAILABLE, never PASS", () => {
  assert.equal(runOutcome([]), "UNAVAILABLE");
});
