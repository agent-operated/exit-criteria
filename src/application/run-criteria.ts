import { isUtf8 } from "node:buffer";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  CriteriaError,
  parseCriteria,
  type CriteriaConfig,
} from "../domain/criteria.js";
import { runOutcome } from "../domain/outcome.js";
import type { Report, RunUnavailableReason } from "../presentation/report.js";
import { evaluate } from "./evaluate.js";

export interface RunCriteriaOptions {
  readonly config: string;
  readonly repoRoot: string;
}

function unavailableReport(reason: RunUnavailableReason, message: string): Report {
  return {
    results: [],
    runOutcome: "UNAVAILABLE",
    unavailableReason: reason,
    message,
  };
}

export class ConfigError extends Error {
  constructor(
    readonly reason: RunUnavailableReason,
    message: string,
  ) {
    super(message);
    this.name = "ConfigError";
  }
}

/** Reads and parses a criteria file without starting any checker. */
export async function readCriteriaConfig(options: RunCriteriaOptions): Promise<CriteriaConfig> {
  const configPath = resolve(options.repoRoot, options.config);

  let sourceBytes: Buffer;
  try {
    sourceBytes = await readFile(configPath);
  } catch (error) {
    throw new ConfigError(
      "config_unavailable",
      error instanceof Error ? error.message : String(error),
    );
  }

  if (!isUtf8(sourceBytes)) {
    throw new ConfigError("invalid_config", "criteria file is not valid UTF-8");
  }

  try {
    return parseCriteria(sourceBytes.toString("utf8"));
  } catch (error) {
    if (!(error instanceof CriteriaError)) {
      throw error;
    }
    throw new ConfigError("invalid_config", error.message);
  }
}

/**
 * Reads and evaluates a criteria file without formatting or writing the final
 * report. Checker diagnostics still flow to stderr; importing does not start a run.
 */
export async function runCriteria(options: RunCriteriaOptions): Promise<Report> {
  let config: CriteriaConfig;
  try {
    config = await readCriteriaConfig(options);
  } catch (error) {
    if (!(error instanceof ConfigError)) {
      throw error;
    }
    return unavailableReport(error.reason, error.message);
  }

  const results = await evaluate(config.criteria, options.repoRoot);
  return {
    configDigest: config.configDigest,
    results,
    runOutcome: runOutcome(results),
  };
}
