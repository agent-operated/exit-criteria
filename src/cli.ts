#!/usr/bin/env node
import { isUtf8 } from "node:buffer";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import process from "node:process";

import { evaluate } from "./application/evaluate.js";
import { CriteriaError, parseCriteria } from "./domain/criteria.js";
import { exitCodeFor, runOutcome } from "./domain/outcome.js";
import {
  formatJson,
  formatText,
  type Report,
  type RunUnavailableReason,
} from "./presentation/report.js";
import { escapeHumanValue } from "./presentation/human-value.js";

interface Options {
  readonly config: string;
  readonly repoRoot: string;
  readonly json: boolean;
}

type CliAction =
  | { readonly kind: "check"; readonly options: Options }
  | { readonly kind: "help" }
  | { readonly kind: "version" };

const HELP = `Usage: exit-criteria check [options]

Options:
  --config PATH      criteria file; relative PATH resolves from --repo-root
                     (default: exit-criteria.yml)
  --repo-root PATH   root used for config and criterion cwd (default: current directory)
  --json             write a versioned JSON report to stdout
  -h, --help         show this help
  -v, --version      show the package version`;

const packageJson = createRequire(import.meta.url)("../../package.json") as { version: string };

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
  if (argv[0] === "--version" || argv[0] === "-v") {
    return { kind: "version" };
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
      case "--version":
      case "-v":
        return { kind: "version" };
      default:
        throw new UsageError(`unknown argument: ${String(arg)}`);
    }
  }
  return { kind: "check", options: { config, repoRoot, json } };
}

function unavailableReport(reason: RunUnavailableReason, message: string): Report {
  return {
    results: [],
    runOutcome: "UNAVAILABLE",
    unavailableReason: reason,
    message,
  };
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
  if (action.kind === "version") {
    process.stdout.write(packageJson.version + "\n");
    return;
  }
  const options = action.options;
  const configPath = resolve(options.repoRoot, options.config);

  let sourceBytes: Buffer;
  try {
    sourceBytes = await readFile(configPath);
  } catch (error) {
    writeReport(
      unavailableReport(
        "config_unavailable",
        error instanceof Error ? error.message : String(error),
      ),
      options.json,
    );
    return;
  }

  if (!isUtf8(sourceBytes)) {
    writeReport(
      unavailableReport("invalid_config", "criteria file is not valid UTF-8"),
      options.json,
    );
    return;
  }
  const source = sourceBytes.toString("utf8");

  let config;
  try {
    config = parseCriteria(source);
  } catch (error) {
    if (!(error instanceof CriteriaError)) {
      throw error;
    }
    writeReport(unavailableReport("invalid_config", error.message), options.json);
    return;
  }

  const results = await evaluate(config.criteria, options.repoRoot);
  const report: Report = {
    configDigest: config.configDigest,
    results,
    runOutcome: runOutcome(results),
  };
  writeReport(report, options.json);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`ERROR ${escapeHumanValue(message)}\n`);
  process.exitCode = 2;
});
