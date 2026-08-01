import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");
const sourceRoot = resolve(repoRoot, "src");

const ALLOWED_NODE_IMPORTS = new Set([
  "node:buffer",
  "node:child_process",
  "node:crypto",
  "node:fs/promises",
  "node:module",
  "node:path",
  "node:process",
]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : extname(path) === ".ts" ? [path] : [];
  });
}

test("core keeps one runtime dependency and one CLI entry point", () => {
  const pkg = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8")) as {
    bin?: Record<string, string>;
    dependencies?: Record<string, string>;
    exports?: unknown;
  };

  assert.deepEqual(Object.keys(pkg.dependencies ?? {}).sort(), ["yaml"]);
  assert.deepEqual(Object.keys(pkg.bin ?? {}).sort(), ["exit-criteria"]);
  assert.equal(pkg.exports, undefined, "a public library API requires a prior boundary decision");
});

test("core source has no network, server, MCP, or unapproved runtime module", () => {
  const modulePattern = /(?:from\s+|import\s*\(|require\s*\()\s*["']([^"']+)["']/g;
  const violations: string[] = [];

  for (const path of sourceFiles(sourceRoot)) {
    const source = readFileSync(path, "utf8");
    if (/\bfetch\s*\(/.test(source)) {
      violations.push(`${path}: global fetch`);
    }
    for (const match of source.matchAll(modulePattern)) {
      const specifier = match[1];
      if (
        specifier !== undefined &&
        !specifier.startsWith(".") &&
        specifier !== "yaml" &&
        !ALLOWED_NODE_IMPORTS.has(specifier)
      ) {
        violations.push(`${path}: ${specifier}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});
