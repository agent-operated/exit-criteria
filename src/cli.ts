#!/usr/bin/env node
import process from "node:process";

import { runCriteria } from "./application/run-criteria.js";
import { exitCodeFor } from "./domain/outcome.js";
import { formatJson, formatText, type Report } from "./presentation/report.js";
import { escapeHumanValue } from "./presentation/human-value.js";

interface Options {
  readonly config: string;
  readonly repoRoot: string;
  readonly json: boolean;
}

type CliAction =
  | { readonly kind: "check"; readonly options: Options }
  | { readonly kind: "help" };

const HELP = `Usage: exit-criteria check [options]

Options:
  --config PATH      criteria file; relative PATH resolves from --repo-root
                     (default: exit-criteria.yml)
  --repo-root PATH   root used for config and criterion cwd (default: current directory)
  --json             write a versioned JSON report to stdout
  -h, --help         show this help`;

class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

function requiredValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new UsageError(`${flag} requires a value`);
  }
  return value;
}

function parseArgs(argv: readonly string[]): CliAction {
  if (argv[0] === "--help" || argv[0] === "-h") {
    return { kind: "help" };
  }
  if (argv[0] !== "check") {
    throw new UsageError("usage: exit-criteria check [options]");
  }
  let config = "exit-criteria.yml";
  let repoRoot = process.cwd();
  let json = false;

  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--config":
        config = requiredValue(argv, index, arg);
        index += 1;
        break;
      case "--repo-root":
        repoRoot = requiredValue(argv, index, arg);
        index += 1;
        break;
      case "--json":
        json = true;
        break;
      case "--help":
      case "-h":
        return { kind: "help" };
      default:
        throw new UsageError(`unknown argument: ${String(arg)}`);
    }
  }
  return { kind: "check", options: { config, repoRoot, json } };
}

function writeReport(report: Report, json: boolean): void {
  process.stdout.write((json ? formatJson(report) : formatText(report)) + "\n");
  process.exitCode = exitCodeFor(report.runOutcome);
}

async function main(): Promise<void> {
  const action = parseArgs(process.argv.slice(2));
  if (action.kind === "help") {
    process.stdout.write(HELP + "\n");
    return;
  }
  const options = action.options;
  const report = await runCriteria(options);
  writeReport(report, options.json);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`ERROR ${escapeHumanValue(message)}\n`);
  process.exitCode = 2;
});
