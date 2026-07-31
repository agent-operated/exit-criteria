import assert from "node:assert/strict";
import test from "node:test";

import { formatJson, formatText, type Report } from "../../src/presentation/report.js";

test("human output escapes line-breaking and display-control characters in dynamic values", () => {
  const report: Report = {
    results: [
      {
        criterionId: "criterion\\id\nline\u001b\u202e",
        text: "日本語 😀\r\u2028\u2066",
        outcome: "PASS",
        exitCode: 0,
      },
    ],
    runOutcome: "PASS",
    message: "path\\name\nfailed\u0000",
  };

  assert.equal(
    formatText(report),
    [
      "PASS        criterion\\\\id\\u000aline\\u001b\\u202e  (exit 0)",
      "            日本語 😀\\u000d\\u2028\\u2066",
      "message: path\\\\name\\u000afailed\\u0000",
      "",
      "run: PASS",
    ].join("\n"),
  );
});

test("JSON report version 2 uses criterion result vocabulary without v1 aliases", () => {
  const output = JSON.parse(
    formatJson({
      configDigest: "sha256:abc",
      results: [
        {
          criterionId: "build",
          text: "Build succeeds",
          outcome: "FAIL",
          exitCode: 1,
        },
      ],
      runOutcome: "FAIL",
    }),
  ) as Record<string, unknown>;

  assert.deepEqual(output, {
    tool: "exit-criteria",
    report_version: 2,
    config_digest: "sha256:abc",
    run_outcome: "FAIL",
    results: [
      {
        criterion_id: "build",
        text: "Build succeeds",
        outcome: "FAIL",
        exit_code: 1,
      },
    ],
  });
  assert.equal("conditions" in output, false);
});
