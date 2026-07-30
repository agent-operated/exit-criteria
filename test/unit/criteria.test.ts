import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { CriteriaError, parseCriteria } from "../../src/domain/criteria.js";

test("one criterion owns its text and executable check", () => {
  const config = parseCriteria(`
version: 1
criteria:
  workbook_opens:
    text: The workbook opens successfully
    argv: ["node", "-e", "process.exit(0)"]
`);

  assert.equal(config.criteria.length, 1);
  assert.deepEqual(config.criteria[0], {
    id: "workbook_opens",
    text: "The workbook opens successfully",
    argv: ["node", "-e", "process.exit(0)"],
    cwd: ".",
    timeoutSeconds: 300,
  });
  const canonical =
    '{"criteria":[{"argv":["node","-e","process.exit(0)"],"cwd":".","id":"workbook_opens","text":"The workbook opens successfully","timeout_seconds":300}],"version":1}';
  const expected = createHash("sha256").update(canonical, "utf8").digest("hex");
  assert.equal(config.configDigest, `sha256:${expected}`);
});

test("formatting, comments, key order, and explicit defaults do not change the digest", () => {
  const first = parseCriteria(`
version: 1
criteria:
  b:
    text: B
    argv: ["node", "b.js"]
  a:
    text: A
    argv: ["node", "a.js"]
`);
  const second = parseCriteria(`
# presentation-only change
criteria:
  a: { argv: ["node", "a.js"], timeout_seconds: 300, cwd: ".", text: A }
  b:
    cwd: "."
    argv:
      - node
      - b.js
    text: B
    timeout_seconds: 300
version: 1
`);

  assert.equal(first.configDigest, second.configDigest);
});

test("every value that can change an evaluation changes the digest", () => {
  const digest = (body: string): string =>
    parseCriteria(`version: 1\ncriteria:\n  a:\n${body}`).configDigest;
  const original = digest(`    text: A\n    argv: ["node", "a.js"]\n`);

  assert.notEqual(original, digest(`    text: B\n    argv: ["node", "a.js"]\n`));
  assert.notEqual(original, digest(`    text: A\n    argv: ["node", "b.js"]\n`));
  assert.notEqual(original, digest(`    text: A\n    argv: ["node", "a.js"]\n    cwd: sub\n`));
  assert.notEqual(
    original,
    digest(`    text: A\n    argv: ["node", "a.js"]\n    timeout_seconds: 1\n`),
  );
});

test("a shell string is rejected as argv", () => {
  assert.throws(
    () =>
      parseCriteria(`
version: 1
criteria:
  a:
    text: A
    argv: "npm test && echo done"
`),
    CriteriaError,
  );
});

test("absolute cwd and unknown fields are rejected", () => {
  assert.throws(
    () =>
      parseCriteria(`
version: 1
criteria:
  a:
    text: A
    argv: ["node", "a.js"]
    cwd: /etc
`),
    CriteriaError,
  );
  assert.throws(
    () =>
      parseCriteria(`
version: 1
criteria:
  a:
    text: A
    argv: ["node", "a.js"]
    optional: true
`),
    /unknown field/,
  );
});

test("manifest composition fields are rejected", () => {
  for (const field of ["include", "extends"]) {
    assert.throws(
      () =>
        parseCriteria(`
version: 1
${field}: shared.yml
criteria:
  a:
    text: A
    argv: ["node", "a.js"]
`),
      /unknown field/,
    );
  }
});

test("a cwd that escapes the repository root is rejected before execution", () => {
  assert.throws(
    () =>
      parseCriteria(`
version: 1
criteria:
  a:
    text: A
    argv: ["node", "a.js"]
    cwd: sub/../../outside
`),
    CriteriaError,
  );
});

test("duplicate criterion ids are rejected regardless of YAML parser defaults", () => {
  assert.throws(
    () =>
      parseCriteria(`
version: 1
criteria:
  duplicate:
    text: First
    argv: ["node", "first.js"]
  duplicate:
    text: Second
    argv: ["node", "second.js"]
`),
    CriteriaError,
  );
});

test("an empty criteria mapping cannot pass vacuously", () => {
  assert.throws(() => parseCriteria("version: 1\ncriteria: {}\n"), CriteriaError);
});

test("timeout_seconds cannot exceed the Node timer range", () => {
  assert.throws(
    () =>
      parseCriteria(`
version: 1
criteria:
  a:
    text: A
    argv: ["node", "a.js"]
    timeout_seconds: 2147483.648
`),
    /timeout_seconds must not exceed 2147483\.647/,
  );
});

test("RFC 8785 canonicalization rejects lone surrogates and accepts valid pairs", () => {
  assert.throws(
    () =>
      parseCriteria(`
version: 1
criteria:
  invalid:
    text: "\\uD800"
    argv: ["node", "a.js"]
`),
    /invalid Unicode/,
  );

  const valid = parseCriteria(`
version: 1
criteria:
  valid:
    text: "\\uD83D\\uDE00"
    argv: ["node", "a.js"]
`);
  assert.equal(valid.criteria[0]?.text, "😀");
});
