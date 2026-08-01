import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { readCriteriaConfig, runCriteria } from "../../src/application/run-criteria.js";

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "exit-criteria-unit-"));
  test.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test("a missing criteria file returns the same config-level unavailable report", async () => {
  const root = temporaryRoot();
  const report = await runCriteria({ config: "missing.yml", repoRoot: root });

  assert.equal(report.runOutcome, "UNAVAILABLE");
  assert.equal(report.unavailableReason, "config_unavailable");
  assert.equal(report.configDigest, undefined);
  assert.deepEqual(report.results, []);
  assert.match(report.message ?? "", /missing\.yml/);
});

test("a non-UTF-8 criteria file returns invalid_config", async () => {
  const root = temporaryRoot();
  writeFileSync(join(root, "criteria.yml"), Buffer.from([0xff]));

  const report = await runCriteria({ config: "criteria.yml", repoRoot: root });

  assert.deepEqual(report, {
    results: [],
    runOutcome: "UNAVAILABLE",
    unavailableReason: "invalid_config",
    message: "criteria file is not valid UTF-8",
  });
});

test("reading a criteria config normalizes defaults without starting its checker", async () => {
  const root = temporaryRoot();
  const marker = join(root, "checker-ran");
  writeFileSync(
    join(root, "criteria.yml"),
    `version: 1
criteria:
  inspect_only:
    text: The config is shown without execution
    argv: [${JSON.stringify(process.execPath)}, "-e", ${JSON.stringify(`require('node:fs').writeFileSync(${JSON.stringify(marker)}, '')`)}]
    cwd: ./support/..
`,
    "utf8",
  );

  const config = await readCriteriaConfig({ config: "criteria.yml", repoRoot: root });

  assert.match(config.configDigest, /^sha256:[a-f0-9]{64}$/u);
  assert.deepEqual(config.criteria, [
    {
      id: "inspect_only",
      text: "The config is shown without execution",
      argv: [
        process.execPath,
        "-e",
        `require('node:fs').writeFileSync(${JSON.stringify(marker)}, '')`,
      ],
      cwd: ".",
      timeoutSeconds: 300,
    },
  ]);
  assert.equal(existsSync(marker), false);
});

test("a valid criteria file is parsed, evaluated, and assembled into a report", async () => {
  const root = temporaryRoot();
  writeFileSync(
    join(root, "criteria.yml"),
    `version: 1
criteria:
  smoke:
    text: The checker exits successfully
    argv: [${JSON.stringify(process.execPath)}, "-e", "process.exit(0)"]
`,
    "utf8",
  );

  const report = await runCriteria({ config: "criteria.yml", repoRoot: root });

  assert.equal(report.runOutcome, "PASS");
  assert.match(report.configDigest ?? "", /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(report.results, [
    {
      criterionId: "smoke",
      text: "The checker exits successfully",
      outcome: "PASS",
      exitCode: 0,
    },
  ]);
});
