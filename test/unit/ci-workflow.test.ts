import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const workflow = readFileSync(resolve(repoRoot, ".github", "workflows", "ci.yml"), "utf8");

test("CI pins third-party actions to immutable commit SHAs", () => {
  assert.match(workflow, /uses:\s*actions\/checkout@[0-9a-f]{40}(?:\s|$)/u);
  assert.match(workflow, /uses:\s*actions\/setup-node@[0-9a-f]{40}(?:\s|$)/u);
});

test("CI does not persist checkout credentials into the PR workspace", () => {
  const checkoutStart = workflow.indexOf("- uses: actions/checkout@");
  assert.notEqual(checkoutStart, -1, "checkout step must exist");

  const nextStep = workflow.indexOf("\n      - uses:", checkoutStart + 1);
  const checkoutStep = workflow.slice(checkoutStart, nextStep === -1 ? workflow.length : nextStep);
  assert.match(checkoutStep, /persist-credentials:\s*false/u);
});
