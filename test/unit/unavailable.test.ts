import assert from "node:assert/strict";
import test from "node:test";

import { evaluate } from "../../src/application/evaluate.js";
import { parseBindings } from "../../src/domain/bindings.js";
import { runOutcome } from "../../src/domain/outcome.js";
import type { ConditionsResult } from "../../src/infrastructure/gtp.js";

const bindings = parseBindings(`
version: 1
issue: https://example.invalid/issues/1
checks:
  a:
    argv: ["node", "-e", "process.exit(0)"]
`);

const oneCondition: ConditionsResult = {
  kind: "acquired",
  conditions: [{ conditionId: "a", text: "t", evidenceKind: "check" }],
};

test("a command that cannot be started is UNAVAILABLE, not PASS and not FAIL", async () => {
  const results = await evaluate(oneCondition, bindings, process.cwd(), async () => ({
    kind: "unavailable",
    reason: "spawn_failed",
  }));

  assert.equal(results.length, 1);
  assert.equal(results[0]?.outcome, "UNAVAILABLE");
  assert.equal(results[0]?.unavailableReason, "spawn_failed");
  assert.notEqual(results[0]?.outcome, "PASS");
});

test("a timed out command is UNAVAILABLE", async () => {
  const results = await evaluate(oneCondition, bindings, process.cwd(), async () => ({
    kind: "unavailable",
    reason: "timeout",
  }));

  assert.equal(results[0]?.outcome, "UNAVAILABLE");
  assert.equal(results[0]?.unavailableReason, "timeout");
});

test("an unavailable condition makes the whole run UNAVAILABLE", () => {
  assert.equal(
    runOutcome([
      { conditionId: "a", outcome: "PASS", evidenceKind: "check", exitCode: 0 },
      { conditionId: "b", outcome: "UNAVAILABLE", evidenceKind: "check" },
    ]),
    "UNAVAILABLE",
  );
});

test("a run that evaluated nothing is UNAVAILABLE, never PASS", () => {
  assert.equal(runOutcome([]), "UNAVAILABLE");
});

test("conditions cannot be acquired means no results, and no results never passes", async () => {
  const unavailable: ConditionsResult = { kind: "unavailable", detail: "gtp exited 2" };
  const results = await evaluate(unavailable, bindings, process.cwd());

  assert.equal(results.length, 0);
  assert.equal(runOutcome(results), "UNAVAILABLE");
});
