import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");
const cli = resolve(repoRoot, "dist", "src", "cli.js");

interface CliRun {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

interface CliReport {
  tool: string;
  report_version: number;
  config_digest?: string;
  run_outcome: string;
  unavailable_reason?: string;
  message?: string;
  results: {
    criterion_id: string;
    text: string;
    outcome: string;
    unavailable_reason?: string;
    exit_code?: number;
  }[];
}

function runCli(config: string, root = repoRoot): CliRun {
  return runRaw(["check", "--config", config, "--repo-root", root, "--json"]);
}

function runRaw(args: readonly string[]): CliRun {
  const result = spawnSync(
    process.execPath,
    [cli, ...args],
    { encoding: "utf8", shell: false, timeout: 30_000 },
  );
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function report(run: CliRun): CliReport {
  assert.notEqual(run.stdout.trim(), "", `expected JSON output; stderr: ${run.stderr}`);
  return JSON.parse(run.stdout) as CliReport;
}

function temporaryConfig(source: string): { root: string; path: string } {
  const root = mkdtempSync(join(tmpdir(), "exit-criteria-"));
  const path = "exit-criteria.yml";
  writeFileSync(join(root, path), source, "utf8");
  return { root, path };
}

async function waitUntil(predicate: () => boolean, message: string): Promise<void> {
  const deadline = performance.now() + 2_000;
  while (!predicate()) {
    if (performance.now() >= deadline) assert.fail(message);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

test("the built CLI evaluates every declared criterion without GTP or a network", () => {
  const run = runCli("test/fixtures/criteria.yml");
  const actual = report(run);

  assert.equal(actual.tool, "exit-criteria");
  assert.equal(actual.report_version, 2);
  assert.match(actual.config_digest ?? "", /^sha256:[a-f0-9]{64}$/);
  assert.equal(actual.run_outcome, "FAIL");
  assert.equal(run.status, 1);
  assert.deepEqual(
    actual.results.map((result) => result.criterion_id),
    ["command_fails", "command_passes"],
  );
  assert.equal(actual.results[0]?.outcome, "FAIL");
  assert.equal(actual.results[0]?.exit_code, 3);
  assert.equal(actual.results[1]?.outcome, "PASS");
  assert.equal(actual.results[1]?.exit_code, 0);
});

test("--repo-root selects another project for both config and checker cwd", () => {
  const fixture = temporaryConfig(`
version: 1
criteria:
  opens:
    text: The checker sees the target project artifact
    argv: ["node", "-e", "require('node:fs').accessSync('artifact.txt')"]
`);
  writeFileSync(join(fixture.root, "artifact.txt"), "present\n", "utf8");
  const run = runCli(fixture.path, fixture.root);

  assert.equal(report(run).run_outcome, "PASS");
  assert.equal(run.status, 0);
});

test("a command that cannot start is reported as UNAVAILABLE and exits two", () => {
  const fixture = temporaryConfig(`
version: 1
criteria:
  missing:
    text: The required checker can run
    argv: ["exit-criteria-command-that-does-not-exist"]
`);
  const run = runCli(fixture.path, fixture.root);
  const actual = report(run);

  assert.equal(actual.run_outcome, "UNAVAILABLE");
  assert.equal(actual.results[0]?.unavailable_reason, "spawn_failed");
  assert.match(run.stderr, /exit-criteria: cannot start/);
  assert.match(run.stderr, /exit-criteria-command-that-does-not-exist/);
  assert.match(run.stderr, /ENOENT/);
  assert.equal(run.status, 2);
});

test("spawn failure diagnostics escape line and terminal-control characters", () => {
  const fixture = temporaryConfig(`
version: 1
criteria:
  missing:
    text: The required checker can run
    argv: ["missing\\nbinary\\u001b\\u202e"]
`);
  const run = runCli(fixture.path, fixture.root);

  assert.equal(run.status, 2);
  assert.equal(report(run).run_outcome, "UNAVAILABLE");
  assert.match(run.stderr, /missing\\u000abinary\\u001b\\u202e/);
  assert.doesNotMatch(run.stderr, /\u001b|\u202e/);
  assert.equal(run.stderr.split("\n").length, 2);
});

test("an unavailable criterion does not prevent later criteria from being evaluated", () => {
  const fixture = temporaryConfig(`
version: 1
criteria:
  a_missing:
    text: The required checker can run
    argv: ["exit-criteria-command-that-does-not-exist"]
  b_later:
    text: Later criteria are still evaluated
    argv: ["node", "-e", "require('node:fs').writeFileSync('later-ran', '')"]
`);
  const run = runCli(fixture.path, fixture.root);
  const actual = report(run);

  assert.equal(run.status, 2);
  assert.equal(actual.run_outcome, "UNAVAILABLE");
  assert.deepEqual(
    actual.results.map((result) => result.criterion_id),
    ["a_missing", "b_later"],
  );
  assert.equal(actual.results[0]?.outcome, "UNAVAILABLE");
  assert.equal(actual.results[1]?.outcome, "PASS");
  assert.equal(existsSync(join(fixture.root, "later-ran")), true);
});

test("invalid configuration still returns a machine-readable report and exits two", () => {
  const fixture = temporaryConfig("version: 1\ncriteria: {}\n");
  const run = runCli(fixture.path, fixture.root);
  const actual = report(run);

  assert.equal(actual.run_outcome, "UNAVAILABLE");
  assert.equal(actual.unavailable_reason, "invalid_config");
  assert.equal(actual.config_digest, undefined);
  assert.equal(run.status, 2);
});

test("invalid UTF-8 is rejected before any checker can run", () => {
  const root = mkdtempSync(join(tmpdir(), "exit-criteria-invalid-utf8-"));
  const path = "exit-criteria.yml";
  const source = Buffer.concat([
    Buffer.from('version: 1\ncriteria:\n  invalid_utf8:\n    text: "A', "utf8"),
    Buffer.from([0xff]),
    Buffer.from(
      'B"\n    argv: ["node", "-e", "require(\'node:fs\').writeFileSync(\'checker-ran\', \'\')"]\n',
      "utf8",
    ),
  ]);
  writeFileSync(join(root, path), source);

  const run = runCli(path, root);
  const actual = report(run);

  assert.equal(run.status, 2);
  assert.equal(actual.run_outcome, "UNAVAILABLE");
  assert.equal(actual.unavailable_reason, "invalid_config");
  assert.match(actual.message ?? "", /not valid UTF-8/);
  assert.equal(actual.config_digest, undefined);
  assert.deepEqual(actual.results, []);
  assert.equal(existsSync(join(root, "checker-ran")), false);
});

test("numeric and quoted criterion ids cannot collide into a false PASS", () => {
  const fixture = temporaryConfig(`
version: 1
criteria:
  1:
    text: Numeric criterion fails
    argv: ["node", "-e", "require('node:fs').writeFileSync('numeric-ran', ''); process.exit(1)"]
  "1":
    text: String criterion passes
    argv: ["node", "-e", "require('node:fs').writeFileSync('string-ran', ''); process.exit(0)"]
`);
  const run = runCli(fixture.path, fixture.root);
  const actual = report(run);

  assert.equal(run.status, 2);
  assert.equal(actual.run_outcome, "UNAVAILABLE");
  assert.equal(actual.unavailable_reason, "invalid_config");
  assert.equal(actual.config_digest, undefined);
  assert.deepEqual(actual.results, []);
  assert.equal(existsSync(join(fixture.root, "numeric-ran")), false);
  assert.equal(existsSync(join(fixture.root, "string-ran")), false);
});

test("human output keeps injected identifiers and text on one physical line", () => {
  const fixture = temporaryConfig(`
version: 1
criteria:
  "line\\nbreak\\\\id\\u202e":
    text: "日本語 stays readable; line\\nbreak; escape \\u001b[31m"
    argv: ["node", "-e", "process.exit(0)"]
`);
  const run = runRaw(["check", "--config", fixture.path, "--repo-root", fixture.root]);

  assert.equal(run.status, 0);
  assert.match(run.stdout, /PASS\s+line\\u000abreak\\\\id\\u202e/);
  assert.match(run.stdout, /日本語 stays readable; line\\u000abreak; escape \\u001b\[31m/);
  assert.doesNotMatch(run.stdout, /\u001b|\u202e/);
  assert.equal(run.stdout.split("\n").length, 6);
});

test("an unavailable configuration file returns a machine-readable report and exits two", () => {
  const root = mkdtempSync(join(tmpdir(), "exit-criteria-"));
  const run = runCli("missing.yml", root);
  const actual = report(run);

  assert.equal(actual.run_outcome, "UNAVAILABLE");
  assert.equal(actual.unavailable_reason, "config_unavailable");
  assert.equal(run.status, 2);
});

test("check diagnostics go to stderr without corrupting the JSON report", () => {
  const fixture = temporaryConfig(`
version: 1
criteria:
  diagnostic:
    text: A failing checker can explain what to repair
    argv:
      - node
      - -e
      - "process.stdout.write('CHECK_OUT'); process.stderr.write('CHECK_ERR'); process.exit(1)"
`);
  const run = runCli(fixture.path, fixture.root);

  assert.equal(report(run).run_outcome, "FAIL");
  assert.match(run.stderr, /CHECK_OUT/);
  assert.match(run.stderr, /CHECK_ERR/);
  assert.equal(run.status, 1);
});

test("help and version are successful informational commands, not PASS reports", () => {
  for (const args of [
    ["--help"],
    ["-h"],
    ["check", "--help"],
    ["check", "-h"],
    ["check", "--json", "--help"],
  ]) {
    const run = runRaw(args);
    assert.equal(run.status, 0);
    assert.match(run.stdout, /exit-criteria check/);
    assert.match(run.stdout, /relative PATH resolves from --repo-root/);
    assert.doesNotMatch(run.stdout, /run_outcome/);
  }

  for (const args of [["--version"], ["-v"], ["check", "--version"], ["check", "-v"]]) {
    const version = runRaw(args);
    assert.equal(version.status, 0);
    assert.equal(version.stdout.trim(), "0.0.0-development");
  }

  for (const args of [["help"], ["version"]]) {
    const unsupported = runRaw(args);
    assert.equal(unsupported.status, 2);
    assert.equal(unsupported.stdout, "");
    assert.match(unsupported.stderr, /usage: exit-criteria check/);
  }
});

test("--json does not invent a report for command-line usage errors", () => {
  for (const args of [
    ["check", "--json", "--unknown"],
    ["check", "--json", "--config"],
  ]) {
    const run = runRaw(args);

    assert.equal(run.status, 2);
    assert.equal(run.stdout, "");
    assert.match(run.stderr, /unknown argument|requires a value/);
  }
});

test("usage diagnostics escape line and terminal-control characters", () => {
  const run = runRaw(["check", "--json", "--unknown\n\u001b\u202e"]);

  assert.equal(run.status, 2);
  assert.equal(run.stdout, "");
  assert.match(run.stderr, /--unknown\\u000a\\u001b\\u202e/);
  assert.doesNotMatch(run.stderr, /\u001b|\u202e/);
  assert.equal(run.stderr.split("\n").length, 2);
});

test("help and version flags are not recognized from option value positions", () => {
  for (const value of ["-h", "-v"]) {
    const run = runRaw(["check", "--config", value, "--json"]);
    const actual = report(run);

    assert.equal(run.status, 2);
    assert.equal(actual.unavailable_reason, "config_unavailable");
    assert.doesNotMatch(run.stdout, /Usage: exit-criteria/);
    assert.notEqual(run.stdout.trim(), "0.0.0-development");
  }

  for (const value of ["--help", "--version"]) {
    const run = runRaw(["check", "--repo-root", value, "--json"]);

    assert.equal(run.status, 2);
    assert.equal(run.stdout, "");
    assert.match(run.stderr, /--repo-root requires a value/);
  }
});

test("a cwd escaping the repository root is invalid configuration, not spawn failure", () => {
  const fixture = temporaryConfig(`
version: 1
criteria:
  escaped:
    text: The check stays inside the repository root
    argv: ["node", "-e", "process.exit(0)"]
    cwd: sub/../../outside
`);
  const run = runCli(fixture.path, fixture.root);
  const actual = report(run);

  assert.equal(actual.unavailable_reason, "invalid_config");
  assert.equal(run.status, 2);
});

test("a checker that violates the foreground contract is bounded by timeout", () => {
  const fixture = temporaryConfig(`
version: 1
criteria:
  "slow\\n\\u001b\\u202e":
    text: The checker finishes before its deadline
    argv:
      - node
      - -e
      - >-
        const { spawn } = require('node:child_process');
        const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 2000)'],
        { stdio: ['ignore', 'inherit', 'inherit'] });
        child.unref();
    timeout_seconds: 0.2
`);
  const started = performance.now();
  const run = runCli(fixture.path, fixture.root);
  const elapsed = performance.now() - started;
  const actual = report(run);

  assert.equal(actual.run_outcome, "UNAVAILABLE");
  assert.equal(actual.results[0]?.unavailable_reason, "timeout");
  assert.equal(run.status, 2);
  assert.match(
    run.stderr,
    /checker "slow\\u000a\\u001b\\u202e" exited but left stdout or stderr open/,
  );
  assert.doesNotMatch(run.stderr, /\u001b|\u202e/);
  assert.ok(elapsed < 1_500, `CLI timeout took ${String(elapsed)}ms`);
});

test("a synchronous command startup error remains a machine-readable UNAVAILABLE report", () => {
  const fixture = temporaryConfig(`
version: 1
criteria:
  invalid_argument:
    text: The checker can start
    argv: ["node", "\\0"]
`);
  const run = runCli(fixture.path, fixture.root);
  const actual = report(run);

  assert.equal(actual.run_outcome, "UNAVAILABLE");
  assert.equal(actual.results[0]?.unavailable_reason, "spawn_failed");
  assert.match(run.stderr, /exit-criteria: cannot start/);
  assert.match(run.stderr, /ERR_INVALID_ARG_VALUE/);
  assert.match(run.stderr, /args\[0\].*null bytes/);
  assert.equal(run.status, 2);
});

test("signal termination is UNAVAILABLE and never invents an exit code", () => {
  const fixture = temporaryConfig(`
version: 1
criteria:
  signaled:
    text: The checker exits normally
    argv: ["node", "-e", "process.kill(process.pid, 'SIGTERM')"]
`);
  const run = runCli(fixture.path, fixture.root);
  const actual = report(run);

  assert.equal(actual.run_outcome, "UNAVAILABLE");
  assert.equal(actual.results[0]?.unavailable_reason, "terminated_by_signal");
  assert.equal(actual.results[0]?.exit_code, undefined);
  assert.equal(run.status, 2);
});

test("SIGINT stops the active checker process instead of orphaning it", async () => {
  const root = mkdtempSync(join(tmpdir(), "exit-criteria-interrupt-"));
  const pidFile = join(root, "checker.pid");
  writeFileSync(
    join(root, "exit-criteria.yml"),
    `
version: 1
criteria:
  interrupted:
    text: The checker is stopped with the CLI
    argv:
      - node
      - -e
      - >-
        require('node:fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
        setTimeout(() => {}, 30000);
`,
    "utf8",
  );

  const running = spawn(
    process.execPath,
    [cli, "check", "--config", "exit-criteria.yml", "--repo-root", root, "--json"],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let stdout = "";
  running.stdout.setEncoding("utf8");
  running.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  running.stderr.resume();

  await waitUntil(() => existsSync(pidFile), "checker did not start");
  const checkerPid = Number(readFileSync(pidFile, "utf8"));
  running.kill("SIGINT");
  const termination = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolveTermination) =>
      running.once("close", (code, signal) => resolveTermination({ code, signal })),
  );

  assert.equal(termination.code, null);
  assert.equal(termination.signal, "SIGINT");
  assert.equal(stdout, "");
  await waitUntil(() => {
    try {
      process.kill(checkerPid, 0);
      return false;
    } catch {
      return true;
    }
  }, "checker process survived CLI SIGINT");
});
