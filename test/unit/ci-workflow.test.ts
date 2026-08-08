import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const workflow = readFileSync(resolve(repoRoot, ".github", "workflows", "ci.yml"), "utf8");

test("CI pins every third-party action reference to an immutable commit SHA", () => {
  const actionReferences = [...workflow.matchAll(/^[ \t]*(?:-[ \t]+)?uses:[ \t]*([^\s#]+)/gmu)].flatMap(
    (match) => (match[1] === undefined ? [] : [match[1]]),
  );
  assert.ok(actionReferences.length > 0, "workflow must declare at least one action");

  const thirdPartyReferences = actionReferences.filter(
    (reference) => !reference.startsWith("./") && !reference.startsWith("../"),
  );
  assert.ok(thirdPartyReferences.length > 0, "workflow must declare a third-party action");
  for (const reference of thirdPartyReferences) {
    const revisionSeparator = reference.lastIndexOf("@");
    assert.notEqual(revisionSeparator, -1, `action reference must include a revision: ${reference}`);
    assert.match(
      reference.slice(revisionSeparator + 1),
      /^[0-9a-f]{40}$/u,
      `third-party action must use a 40-character commit SHA: ${reference}`,
    );
  }
});

test("CI does not persist checkout credentials into the PR workspace", () => {
  const checkoutStart = workflow.indexOf("- uses: actions/checkout@");
  assert.notEqual(checkoutStart, -1, "checkout step must exist");

  const nextStep = workflow.indexOf("\n      - uses:", checkoutStart + 1);
  const checkoutStep = workflow.slice(checkoutStart, nextStep === -1 ? workflow.length : nextStep);
  assert.match(checkoutStep, /persist-credentials:\s*false/u);
});
