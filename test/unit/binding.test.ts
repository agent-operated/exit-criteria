import assert from "node:assert/strict";
import test from "node:test";

import { evaluate } from "../../src/application/evaluate.js";
import { BindingError, parseBindings } from "../../src/domain/bindings.js";
import type { ConditionsResult } from "../../src/infrastructure/gtp.js";

const bindings = parseBindings(`
version: 1
issue: https://example.invalid/issues/1
checks:
  bound:
    argv: ["node", "-e", "process.exit(0)"]
`);

const twoConditions: ConditionsResult = {
  kind: "acquired",
  conditions: [
    { conditionId: "bound", text: "t", evidenceKind: "check" },
    { conditionId: "unbound", text: "t", evidenceKind: "check" },
  ],
};

test("a condition with no binding is reported as UNAVAILABLE, not skipped", async () => {
  const results = await evaluate(twoConditions, bindings, process.cwd());

  assert.equal(results.length, 2, "every projected condition must appear in the report");

  const unbound = results.find((r) => r.conditionId === "unbound");
  assert.equal(unbound?.outcome, "UNAVAILABLE");
  assert.equal(unbound?.unavailableReason, "no_binding");
});

test("an unbound condition is never counted as success", async () => {
  const results = await evaluate(twoConditions, bindings, process.cwd());
  const unbound = results.find((r) => r.conditionId === "unbound");

  assert.notEqual(unbound?.outcome, "PASS");
  assert.notEqual(unbound?.outcome, "FAIL");
});

test("evidence kinds other than check are UNAVAILABLE, not passed by default", async () => {
  const artifactCondition: ConditionsResult = {
    kind: "acquired",
    conditions: [{ conditionId: "doc", text: "t", evidenceKind: "artifact" }],
  };
  const results = await evaluate(artifactCondition, bindings, process.cwd());

  assert.equal(results[0]?.outcome, "UNAVAILABLE");
});

test("a shell string is rejected as a command", () => {
  assert.throws(
    () =>
      parseBindings(`
version: 1
issue: https://example.invalid/issues/1
checks:
  a:
    argv: "npm test && echo done"
`),
    BindingError,
  );
});

test("a cwd escaping the repository root is rejected", () => {
  assert.throws(
    () =>
      parseBindings(`
version: 1
issue: https://example.invalid/issues/1
checks:
  a:
    argv: ["node", "-e", ""]
    cwd: "/etc"
`),
    BindingError,
  );
});
