#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

import { evaluate } from "./application/evaluate.js";
import { parseBindings } from "./domain/bindings.js";
import { exitCodeFor, runOutcome } from "./domain/outcome.js";
import { readConditions } from "./infrastructure/gtp.js";
import { formatJson, formatText, type Report } from "./presentation/report.js";

interface Options {
  readonly issue?: string;
  readonly bindings: string;
  readonly repoRoot: string;
  readonly json: boolean;
}

function parseArgs(argv: readonly string[]): Options {
  let issue: string | undefined;
  let bindings = "exit-criteria.yml";
  let repoRoot = process.cwd();
  let json = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case "--issue":
        issue = next;
        i += 1;
        break;
      case "--bindings":
        if (next !== undefined) bindings = next;
        i += 1;
        break;
      case "--repo-root":
        if (next !== undefined) repoRoot = next;
        i += 1;
        break;
      case "--json":
        json = true;
        break;
      default:
        throw new Error(`unknown argument: ${String(arg)}`);
    }
  }
  return issue === undefined ? { bindings, repoRoot, json } : { issue, bindings, repoRoot, json };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const bindingPath = resolve(options.repoRoot, options.bindings);
  const bindings = parseBindings(await readFile(bindingPath, "utf8"));
  const issue = options.issue ?? bindings.issue;

  // The GTP binary is host-supplied. Never hard-code a path: it differs per
  // machine and would leak a local absolute path into a public artifact.
  const gtpBin = process.env["GTP_BIN"] ?? "gtp";

  const conditions = await readConditions(issue, gtpBin);
  const results = await evaluate(conditions, bindings, options.repoRoot);

  const report: Report = {
    issue,
    results,
    runOutcome: runOutcome(results),
    ...(conditions.kind === "unavailable" ? { statusDetail: conditions.detail } : {}),
  };

  process.stdout.write((options.json ? formatJson(report) : formatText(report)) + "\n");
  process.exitCode = exitCodeFor(report.runOutcome);
}

main().catch((error: unknown) => {
  process.stderr.write(`ERROR ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 2;
});
