#!/usr/bin/env node

import { chmod, copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";
import { parseDocument } from "yaml";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const skillSource = resolve(repositoryRoot, "skills", "exit-criteria");
const assetRoot = resolve(repositoryRoot, "dist", "skill", "exit-criteria");
const runnerOutput = resolve(assetRoot, "scripts", "exit-criteria.mjs");

function releaseTag(argv) {
  if (argv.length !== 1 || argv[0].length === 0) {
    throw new Error("usage: npm run build:skill -- <git-tag>");
  }
  return argv[0];
}

function skillWithVersion(source, version) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(source);
  if (match?.[1] === undefined) {
    throw new Error("source SKILL.md frontmatter is missing");
  }

  const document = parseDocument(match[1], { uniqueKeys: true });
  if (document.errors.length > 0) {
    throw new Error(`source SKILL.md frontmatter is invalid: ${document.errors[0]?.message}`);
  }
  document.setIn(["metadata", "version"], version);

  const frontmatter = document.toString({ lineWidth: 0 }).trimEnd();
  const body = source.slice(match[0].length);
  const output = `---\n${frontmatter}\n---\n${body}`;

  const check = /^---\n([\s\S]*?)\n---\n/u.exec(output);
  const checkDocument = parseDocument(check?.[1] ?? "", { uniqueKeys: true });
  if (checkDocument.getIn(["metadata", "version"]) !== version) {
    throw new Error("generated SKILL.md did not preserve the exact tag as metadata.version");
  }
  return output;
}

async function thirdPartyNotices() {
  const packageJson = JSON.parse(
    await readFile(resolve(repositoryRoot, "node_modules", "yaml", "package.json"), "utf8"),
  );
  if (packageJson.name !== "yaml" || typeof packageJson.version !== "string") {
    throw new Error("installed yaml package metadata is invalid");
  }
  const license = await readFile(
    resolve(repositoryRoot, "node_modules", "yaml", "LICENSE"),
    "utf8",
  );
  return `Third-Party Notices\n\nyaml ${packageJson.version} (ISC)\n\n${license.trimEnd()}\n`;
}

async function main() {
  const version = releaseTag(process.argv.slice(2));
  const sourceSkill = await readFile(resolve(skillSource, "SKILL.md"), "utf8");

  await rm(assetRoot, { recursive: true, force: true });
  await mkdir(resolve(assetRoot, "agents"), { recursive: true });
  await mkdir(resolve(assetRoot, "scripts"), { recursive: true });

  await writeFile(resolve(assetRoot, "SKILL.md"), skillWithVersion(sourceSkill, version), "utf8");
  await copyFile(
    resolve(skillSource, "agents", "openai.yaml"),
    resolve(assetRoot, "agents", "openai.yaml"),
  );
  await copyFile(resolve(repositoryRoot, "LICENSE"), resolve(assetRoot, "LICENSE"));
  await writeFile(
    resolve(assetRoot, "THIRD_PARTY_NOTICES.txt"),
    await thirdPartyNotices(),
    "utf8",
  );

  await build({
    entryPoints: [resolve(skillSource, "scripts", "runner.ts")],
    outfile: runnerOutput,
    banner: {
      js: 'import { createRequire as __exitCriteriaCreateRequire } from "node:module";\nconst require = __exitCriteriaCreateRequire(import.meta.url);',
    },
    bundle: true,
    define: {
      __EXIT_CRITERIA_VERSION__: JSON.stringify(version),
    },
    format: "esm",
    legalComments: "none",
    minify: false,
    platform: "node",
    sourcemap: false,
    target: "node20",
  });
  await chmod(runnerOutput, 0o755);

  process.stdout.write(`${assetRoot}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
