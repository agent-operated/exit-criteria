import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";

import { formatJson, type Report } from "../../src/presentation/report.js";

function compileSchema(path: string): ValidateFunction {
  const schema = JSON.parse(readFileSync(path, "utf8")) as object;
  return new Ajv2020({ allErrors: true, strict: true }).compile(schema);
}

const validateManifest = compileSchema("schemas/manifest-v1.schema.json");
const validateReport = compileSchema("schemas/report-v2.schema.json");
const digest = `sha256:${"a".repeat(64)}`;

function expectValid(validate: ValidateFunction, value: unknown): void {
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
}

function expectInvalid(validate: ValidateFunction, value: unknown): void {
  assert.equal(validate(value), false, "expected schema validation to fail");
}

test("Draft 2020-12 manifest schema accepts the version 1 JSON data model", () => {
  expectValid(validateManifest, {
    version: 1,
    criteria: {
      build: {
        text: "Build succeeds",
        argv: ["npm", "run", "build"],
      },
      test: {
        text: "Tests pass",
        argv: ["npm", "test"],
        cwd: "packages/core",
        timeout_seconds: 30.5,
      },
    },
  });
});

test("manifest schema rejects empty identifiers, missing checks, limits, and unknown fields", () => {
  const invalidManifests = [
    { version: 1, criteria: {} },
    {
      version: 1,
      criteria: { "": { text: "Build succeeds", argv: ["npm", "run", "build"] } },
    },
    { version: 1, criteria: { build: { text: "Build succeeds" } } },
    {
      version: 1,
      criteria: {
        build: { text: "Build succeeds", argv: [], timeout_seconds: 0 },
      },
    },
    {
      version: 1,
      criteria: {
        build: {
          text: "Build succeeds",
          argv: ["npm", "run", "build"],
          timeout_seconds: 2147483.648,
        },
      },
    },
    {
      version: 1,
      criteria: {
        build: { text: "Build succeeds", argv: ["npm", "run", "build"], optional: true },
      },
    },
    { version: 1, criteria: { build: { text: "   ", argv: ["npm", "test"] } } },
    { version: 1, criteria: { build: { text: "Build succeeds", argv: ["npm", "test"] } }, extra: true },
  ];

  for (const manifest of invalidManifests) {
    expectInvalid(validateManifest, manifest);
  }
});

test("report schema accepts actual formatter output for every evaluated result shape", () => {
  const reports: Report[] = [
    {
      configDigest: digest,
      runOutcome: "PASS",
      results: [{ criterionId: "build", text: "Build succeeds", outcome: "PASS", exitCode: 0 }],
    },
    {
      configDigest: digest,
      runOutcome: "FAIL",
      results: [
        { criterionId: "build", text: "Build succeeds", outcome: "PASS", exitCode: 0 },
        { criterionId: "test", text: "Tests pass", outcome: "FAIL", exitCode: 1 },
      ],
    },
    {
      configDigest: digest,
      runOutcome: "UNAVAILABLE",
      results: [
        {
          criterionId: "test",
          text: "Tests pass",
          outcome: "UNAVAILABLE",
          unavailableReason: "spawn_failed",
        },
        {
          criterionId: "timeout",
          text: "Check completes",
          outcome: "UNAVAILABLE",
          unavailableReason: "timeout",
        },
        {
          criterionId: "signal",
          text: "Check completes normally",
          outcome: "UNAVAILABLE",
          unavailableReason: "terminated_by_signal",
        },
      ],
    },
  ];

  for (const report of reports) {
    expectValid(validateReport, JSON.parse(formatJson(report)));
  }
});

test("report schema accepts both run-level configuration failures", () => {
  for (const unavailableReason of ["config_unavailable", "invalid_config"] as const) {
    const report: Report = {
      runOutcome: "UNAVAILABLE",
      results: [],
      unavailableReason,
      message: "criteria file could not be evaluated",
    };
    expectValid(validateReport, JSON.parse(formatJson(report)));
  }
});

test("report schema rejects outcome contradictions, aliases, and unknown fields", () => {
  const pass = {
    tool: "exit-criteria",
    report_version: 2,
    config_digest: digest,
    run_outcome: "PASS",
    results: [
      { criterion_id: "build", text: "Build succeeds", outcome: "PASS", exit_code: 0 },
    ],
  };

  const invalidReports = [
    { ...pass, conditions: pass.results },
    {
      ...pass,
      results: [{ condition_id: "build", text: "Build succeeds", outcome: "PASS", exit_code: 0 }],
    },
    { ...pass, results: [{ ...pass.results[0], exit_code: 1 }] },
    { ...pass, run_outcome: "FAIL" },
    {
      ...pass,
      run_outcome: "UNAVAILABLE",
      results: [
        {
          criterion_id: "build",
          text: "Build succeeds",
          outcome: "UNAVAILABLE",
          unavailable_reason: "timeout",
          exit_code: 1,
        },
      ],
    },
    {
      tool: "exit-criteria",
      report_version: 2,
      config_digest: digest,
      run_outcome: "UNAVAILABLE",
      results: [],
      unavailable_reason: "invalid_config",
      message: "invalid",
    },
  ];

  for (const report of invalidReports) {
    expectInvalid(validateReport, report);
  }
});
