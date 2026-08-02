#!/usr/bin/env node
import { isUtf8 } from "node:buffer";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import process from "node:process";

import { parseDocument } from "yaml";

import {
  ConfigError,
  readCriteriaConfig,
  runCriteria,
} from "../../../src/application/run-criteria.js";
import { exitCodeFor } from "../../../src/domain/outcome.js";
import { escapeHumanValue } from "../../../src/presentation/human-value.js";
import { formatJson, formatText, type Report } from "../../../src/presentation/report.js";

declare const __EXIT_CRITERIA_VERSION__: string;

interface ConfigOptions {
  readonly config: string;
  readonly repoRoot: string;
}

interface CheckOptions extends ConfigOptions {
  readonly json: boolean;
}

type CliAction =
  | { readonly kind: "check"; readonly options: CheckOptions }
  | { readonly kind: "help" }
  | { readonly kind: "show-config"; readonly options: ConfigOptions }
  | { readonly kind: "version" };

const BUNDLED_VERSION = __EXIT_CRITERIA_VERSION__;
const SKILL_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "..", "SKILL.md");
const HELP = `Usage: exit-criteria check [options]
       exit-criteria show-config [options]

Options:
  --config PATH      criteria file; relative PATH resolves from --repo-root
                     (default: exit-criteria.yml)
  --repo-root PATH   root used for config and criterion cwd (default: current directory)
  --json             write a versioned JSON report to stdout (check only)
  -h, --help         show this help
  -v, --version      show the Skill release version`;

class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

class SkillError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkillError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new UsageError(`${flag} requires a value`);
  }
  return value;
}

function parseArgs(argv: readonly string[]): CliAction {
  if (argv[0] === "--help" || argv[0] === "-h") return { kind: "help" };
  if (argv[0] === "--version" || argv[0] === "-v") return { kind: "version" };
  const command = argv[0];
  if (command !== "check" && command !== "show-config") {
    throw new UsageError("usage: exit-criteria <check|show-config> [options]");
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
        if (command === "show-config") {
          throw new UsageError("unknown argument: --json");
        }
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

  return command === "check"
    ? { kind: "check", options: { config, repoRoot, json } }
    : { kind: "show-config", options: { config, repoRoot } };
}

async function readDeclaredVersion(): Promise<string> {
  let bytes: Buffer;
  try {
    bytes = await readFile(SKILL_PATH);
  } catch (error) {
    throw new SkillError(
      `cannot read SKILL.md: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!isUtf8(bytes)) throw new SkillError("SKILL.md is not valid UTF-8");

  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(bytes.toString("utf8"));
  if (match?.[1] === undefined) throw new SkillError("SKILL.md frontmatter is missing");

  const document = parseDocument(match[1], { uniqueKeys: true });
  if (document.errors.length > 0) {
    throw new SkillError(`SKILL.md frontmatter is invalid: ${document.errors[0]?.message}`);
  }

  let frontmatter: unknown;
  try {
    frontmatter = document.toJS();
  } catch (error) {
    throw new SkillError(
      `SKILL.md frontmatter is invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const metadata = isRecord(frontmatter) ? frontmatter["metadata"] : undefined;
  const version = isRecord(metadata) ? metadata["version"] : undefined;
  if (typeof version !== "string" || version.length === 0) {
    throw new SkillError("SKILL.md metadata.version is missing or not a string");
  }
  return version;
}

async function assertSkillVersion(): Promise<void> {
  const declaredVersion = await readDeclaredVersion();
  if (declaredVersion !== BUNDLED_VERSION) {
    throw new SkillError(
      `version mismatch: SKILL.md declares ${JSON.stringify(declaredVersion)} but runner declares ${JSON.stringify(BUNDLED_VERSION)}`,
    );
  }
}

function writeReport(report: Report, json: boolean): void {
  process.stdout.write((json ? formatJson(report) : formatText(report)) + "\n");
  process.exitCode = exitCodeFor(report.runOutcome);
}

async function main(): Promise<void> {
  await assertSkillVersion();
  const action = parseArgs(process.argv.slice(2));
  if (action.kind === "help") {
    process.stdout.write(HELP + "\n");
    return;
  }
  if (action.kind === "version") {
    process.stdout.write(BUNDLED_VERSION + "\n");
    return;
  }

  const options = action.options;
  const repoRoot = resolve(options.repoRoot);
  const configPath = resolve(repoRoot, options.config);
  if (action.kind === "show-config") {
    const config = await readCriteriaConfig({ config: configPath, repoRoot });
    process.stdout.write(
      JSON.stringify(
        {
          config_digest: config.configDigest,
          criteria: config.criteria.map((criterion) => ({
            id: criterion.id,
            text: criterion.text,
            argv: criterion.argv,
            cwd: criterion.cwd,
            timeout_seconds: criterion.timeoutSeconds,
          })),
        },
        null,
        2,
      ) + "\n",
    );
    return;
  }
  const report = await runCriteria({
    config: configPath,
    repoRoot,
  });
  writeReport(report, action.options.json);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const prefix =
    error instanceof SkillError
      ? "SKILL ERROR"
      : error instanceof ConfigError
        ? `CONFIG ERROR ${error.reason}`
        : "ERROR";
  process.stderr.write(`${prefix} ${escapeHumanValue(message)}\n`);
  process.exitCode = 2;
});
