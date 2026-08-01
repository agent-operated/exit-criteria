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

test("criteria are normalized in ascending UTF-16 code unit order", () => {
  const config = parseCriteria(`
version: 1
criteria:
  "\uE000":
    text: Private-use BMP criterion
    argv: ["node", "bmp.js"]
  "\uD83D\uDE00":
    text: Supplementary criterion
    argv: ["node", "supplementary.js"]
`);

  assert.deepEqual(
    config.criteria.map((criterion) => criterion.id),
    ["😀", "\uE000"],
  );
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

test("criterion cwd treats backslashes as portable path separators", () => {
  const config = parseCriteria(`
version: 1
criteria:
  a:
    text: A
    argv: ["node", "a.js"]
    cwd: 'checks\\nested'
`);

  assert.equal(config.criteria[0]?.cwd, "checks/nested");
});

test("criterion cwd rejects direct and normalized drive-prefixed forms on supported platforms", () => {
  for (const cwd of [
    "C:/checks",
    "C:\\checks",
    "C:checks",
    "a:b",
    "./C:checks",
    "sub/../C:checks",
    "./a:b",
    ".\\C:checks",
    "sub\\..\\C:checks",
    ".\\a:b",
  ]) {
    assert.throws(
      () =>
        parseCriteria(`
version: 1
criteria:
  a:
    text: A
    argv: ["node", "a.js"]
    cwd: ${JSON.stringify(cwd)}
`),
      /cwd must be relative to the repository root/,
    );
  }
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

test("non-string mapping keys are rejected before YAML-to-object conversion", () => {
  const examples = [
    `
1: ignored
version: 1
criteria:
  a:
    text: A
    argv: ["node", "a.js"]
`,
    `
true: ignored
version: 1
criteria:
  a:
    text: A
    argv: ["node", "a.js"]
`,
    `
? [compound, key]
: ignored
version: 1
criteria:
  a:
    text: A
    argv: ["node", "a.js"]
`,
    `
version: 1
criteria:
  1:
    text: Numeric
    argv: ["node", "numeric.js"]
  "1":
    text: String
    argv: ["node", "string.js"]
`,
    `
version: 1
criteria:
  a:
    1: ignored
    text: A
    argv: ["node", "a.js"]
`,
  ];

  for (const source of examples) {
    assert.throws(
      () => parseCriteria(source),
      /criteria file contains a non-string mapping key/,
    );
  }
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

test("invalid Unicode diagnostics identify the criterion field", () => {
  const invalid = [
    {
      source: `
version: 1
criteria:
  "\\uD800":
    text: A
    argv: ["node", "a.js"]
`,
      message: /criterion id contains invalid Unicode/,
    },
    {
      source: `
version: 1
criteria:
  a:
    text: "\\uD800"
    argv: ["node", "a.js"]
`,
      message: /criterion "a" text contains invalid Unicode/,
    },
    {
      source: `
version: 1
criteria:
  a:
    text: A
    argv: ["node", "\\uD800"]
`,
      message: /criterion "a" argv\[1\] contains invalid Unicode/,
    },
    {
      source: `
version: 1
criteria:
  a:
    text: A
    argv: ["node", "a.js"]
    cwd: "\\uD800"
`,
      message: /criterion "a" cwd contains invalid Unicode/,
    },
  ];

  for (const example of invalid) {
    assert.throws(() => parseCriteria(example.source), example.message);
  }
});

test("RFC 8785 canonicalization accepts valid surrogate pairs", () => {
  const valid = parseCriteria(`
version: 1
criteria:
  valid:
    text: "\\uD83D\\uDE00"
    argv: ["node", "a.js"]
`);
  assert.equal(valid.criteria[0]?.text, "😀");
});
