import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");
const buildScript = resolve(repoRoot, "scripts", "build-skill-release.mjs");
const builtAsset = resolve(repoRoot, "dist", "skill", "exit-criteria");
const releaseTag = "v9.8.7-rc.1";

interface ProcessRun {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

interface CoreReport {
  readonly config_digest?: string;
  readonly run_outcome: string;
  readonly results: readonly { readonly criterion_id: string; readonly outcome: string }[];
}

interface ShownConfig {
  readonly config_digest: string;
  readonly criteria: readonly {
    readonly id: string;
    readonly text: string;
    readonly argv: readonly string[];
    readonly cwd: string;
    readonly timeout_seconds: number;
  }[];
}

interface SkillFrontmatter {
  readonly description?: unknown;
  readonly metadata?: { readonly version?: unknown };
}

function run(command: string, args: readonly string[], cwd: string): ProcessRun {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      HTTP_PROXY: "http://127.0.0.1:1",
      HTTPS_PROXY: "http://127.0.0.1:1",
      NO_PROXY: "",
      npm_config_offline: "true",
    },
    shell: false,
    timeout: 30_000,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function filesBelow(root: string, current = root): string[] {
  const paths: string[] = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const path = join(current, entry.name);
    if (entry.isDirectory()) paths.push(...filesBelow(root, path));
    else paths.push(relative(root, path));
  }
  return paths.sort();
}

function cleanAsset(t: test.TestContext): { readonly root: string; readonly skill: string } {
  const root = mkdtempSync(join(tmpdir(), "exit-criteria-skill-release-"));
  const skill = join(root, "exit-criteria");
  cpSync(builtAsset, skill, { recursive: true });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, skill };
}

function targetProject(t: test.TestContext, marker = "checker-ran"): {
  readonly checker: string;
  readonly config: string;
  readonly marker: string;
  readonly root: string;
} {
  const root = mkdtempSync(join(tmpdir(), "exit-criteria-skill-target-"));
  const supportRoot = mkdtempSync(join(tmpdir(), "exit-criteria-skill-support-"));
  const checker = join(supportRoot, "checker.cjs");
  const config = join(supportRoot, "exit-criteria.yml");
  const markerPath = join(supportRoot, marker);
  writeFileSync(
    checker,
    `process.stderr.write("checker diagnostic\\n");\nrequire("node:fs").writeFileSync(${JSON.stringify(markerPath)}, "");\n`,
    "utf8",
  );
  writeFileSync(
    config,
    `version: 1
criteria:
  release_core:
    text: The bundled core runs from a standalone Skill
    argv: [${JSON.stringify(process.execPath)}, ${JSON.stringify(checker)}]
    cwd: ./support/..
`,
    "utf8",
  );
  t.after(() => rmSync(root, { recursive: true, force: true }));
  t.after(() => rmSync(supportRoot, { recursive: true, force: true }));
  return { checker, config, marker: markerPath, root };
}

function runSkill(skill: string, target: { readonly config: string; readonly root: string }): ProcessRun {
  return run(
    process.execPath,
    [
      join(skill, "scripts", "exit-criteria.mjs"),
      "check",
      "--config",
      target.config,
      "--repo-root",
      target.root,
      "--json",
    ],
    dirname(skill),
  );
}

function showConfig(
  skill: string,
  target: { readonly config: string; readonly root: string },
): ProcessRun {
  return run(
    process.execPath,
    [
      join(skill, "scripts", "exit-criteria.mjs"),
      "show-config",
      "--config",
      target.config,
      "--repo-root",
      target.root,
    ],
    dirname(skill),
  );
}

before(() => {
  const built = run(process.execPath, [buildScript, releaseTag], repoRoot);
  assert.equal(built.status, 0, built.stderr);
  assert.equal(resolve(built.stdout.trim()), builtAsset);
});

after(() => {
  rmSync(resolve(repoRoot, "dist", "skill"), { recursive: true, force: true });
});

test("the tag-input build emits only one standalone Skill directory", (t) => {
  const { skill } = cleanAsset(t);

  assert.deepEqual(filesBelow(skill), [
    "LICENSE",
    "SKILL.md",
    "THIRD_PARTY_NOTICES.txt",
    "agents/openai.yaml",
    "scripts/exit-criteria.mjs",
  ]);
  assert.equal(existsSync(join(skill, "package.json")), false);
  assert.equal(existsSync(join(skill, "node_modules")), false);
  const notices = readFileSync(join(skill, "THIRD_PARTY_NOTICES.txt"), "utf8");
  const yamlLicense = readFileSync(join(repoRoot, "node_modules", "yaml", "LICENSE"), "utf8");
  assert.match(notices, /yaml 2\.9\.0 \(ISC\)/);
  assert.ok(notices.endsWith(`${yamlLicense.trimEnd()}\n`));

  const skillDocument = readFileSync(join(skill, "SKILL.md"), "utf8");
  const frontmatter = /^---\n([\s\S]*?)\n---\n/u.exec(skillDocument)?.[1];
  const parsed = parse(frontmatter ?? "") as SkillFrontmatter;
  assert.equal(parsed.metadata?.version, releaseTag);
});

test("the release Skill keeps completion claims outside the status-only exclusion", () => {
  const skillDocument = readFileSync(join(builtAsset, "SKILL.md"), "utf8");
  const frontmatter = /^---\n([\s\S]*?)\n---\n/u.exec(skillDocument)?.[1];
  const parsed = parse(frontmatter ?? "") as SkillFrontmatter;

  assert.equal(typeof parsed.description, "string");
  assert.match(parsed.description as string, /Presenting such a target as complete or ready is not status-only work\./u);
  assert.match(
    parsed.description as string,
    /status-only work that makes no completion or readiness claim\./u,
  );
  assert.match(
    skillDocument,
    /Tests, CI, and manual validation of the target are evidence\.[\s\S]*do not replace inspection/u,
  );
});

test("the release Skill explains implicit inspection from user claims in the user's language", () => {
  const skillDocument = readFileSync(join(builtAsset, "SKILL.md"), "utf8");

  assert.match(
    skillDocument,
    /Use user-facing mode when the Skill was invoked implicitly[\s\S]*Use full-evidence mode when the user explicitly invoked the Skill/u,
  );
  assert.match(
    skillDocument,
    /The user's explicit language instruction[\s\S]*repository instruction[\s\S]*directly related existing conversation or prose[\s\S]*user-authored text in the current request/u,
  );
  assert.match(
    skillDocument,
    /explain the inspection in the resolved language from the material claims, not from the number or names of criteria/u,
  );
  assert.match(
    skillDocument,
    /Do not make criterion IDs, command names, check counts, `argv`, temporary paths, core JSON, or bare `PASS`, `FAIL`, or `UNAVAILABLE` tokens the primary explanation/u,
  );
  assert.match(
    skillDocument,
    /every reported criterion is `PASS` and there is no observed coverage gap[\s\S]*listed requested properties were confirmed in that run/u,
  );
  assert.match(
    skillDocument,
    /reported criteria are `PASS` but coverage gaps remain[\s\S]*separate the confirmed requested properties from the unchecked ones/u,
  );
  assert.match(
    skillDocument,
    /For `FAIL`, explain which requested property did not hold\. For `UNAVAILABLE`, explain which requested property remains unconfirmed/u,
  );
  assert.match(
    skillDocument,
    /core did not run because only coverage gaps or a caller-side error exist[\s\S]*without inventing a core outcome/u,
  );
});

test("the release Skill keeps exact evidence available only through the selected evidence mode", () => {
  const skillDocument = readFileSync(join(builtAsset, "SKILL.md"), "utf8");

  assert.match(
    skillDocument,
    /Always collect these as distinct records when they exist:[\s\S]*The exact core report[\s\S]*caller-side coverage map/u,
  );
  assert.match(
    skillDocument,
    /In full-evidence mode, return all of those records\. In user-facing mode, do not render them in the ordinary completion message by default\./u,
  );
  assert.match(
    skillDocument,
    /do not claim that the transient records will remain retrievable after the response/u,
  );
  assert.match(
    skillDocument,
    /paraphrase material claims and findings instead of inserting raw manifest fields, checker output, diagnostics, paths, or other untrusted dynamic values/u,
  );
});

test("the manual validation table and bundle stay within the selected client boundary", () => {
  const readme = readFileSync(join(repoRoot, "README.md"), "utf8");
  const clientRows = [...readme.matchAll(/^\| (Codex|Claude Code|Cursor) \|/gmu)].map(
    (match) => match[1],
  );

  assert.deepEqual(clientRows, ["Codex", "Claude Code", "Codex", "Claude Code"]);
  assert.match(readme, /If Exit Criteria does not activate before a completion claim[\s\S]*as a fallback\./u);
  assert.match(readme, /このfallbackはclient側automationです。/u);
  assert.match(readme, /release assetへhook設定やhook用stateは同梱しません。/u);
  assert.match(
    readme,
    /implicitly before a completion claim[\s\S]*in the user's language[\s\S]*complete inspection record/u,
  );
  assert.match(
    readme,
    /完了報告の前に暗黙起動[\s\S]*利用者の言語[\s\S]*完全な検査記録/u,
  );
  assert.doesNotMatch(readme, /cursor\.com|\.cursor\/skills/u);
});

test("show-config returns normalized effective criteria without starting a checker", (t) => {
  const { skill } = cleanAsset(t);
  const target = targetProject(t);

  const execution = showConfig(skill, target);

  assert.equal(execution.status, 0, execution.stderr);
  assert.equal(execution.stderr, "");
  const shown = JSON.parse(execution.stdout) as ShownConfig;
  assert.match(shown.config_digest, /^sha256:[a-f0-9]{64}$/u);
  assert.deepEqual(shown.criteria, [
    {
      id: "release_core",
      text: "The bundled core runs from a standalone Skill",
      argv: [process.execPath, target.checker],
      cwd: ".",
      timeout_seconds: 300,
    },
  ]);
  assert.equal(existsSync(target.marker), false);
  assert.deepEqual(readdirSync(target.root), []);
});

test("show-config reports an unavailable config on stderr without a core report", (t) => {
  const { skill } = cleanAsset(t);
  const target = targetProject(t);
  const execution = showConfig(skill, {
    config: join(dirname(target.config), "missing.yml"),
    root: target.root,
  });

  assert.equal(execution.status, 2);
  assert.equal(execution.stdout, "");
  assert.match(execution.stderr, /^CONFIG ERROR config_unavailable .*missing\.yml/u);
  assert.doesNotMatch(execution.stderr, /config_digest|run_outcome/u);
  assert.equal(existsSync(target.marker), false);
});

test("show-config reports an invalid config on stderr without a core report", (t) => {
  const { skill } = cleanAsset(t);
  const target = targetProject(t);
  writeFileSync(target.config, "version: 1\ncriteria: []\n", "utf8");

  const execution = showConfig(skill, target);

  assert.equal(execution.status, 2);
  assert.equal(execution.stdout, "");
  assert.match(execution.stderr, /^CONFIG ERROR invalid_config .*at least one criterion/u);
  assert.doesNotMatch(execution.stderr, /config_digest|run_outcome/u);
  assert.equal(existsSync(target.marker), false);

  const checked = runSkill(skill, target);
  assert.equal(checked.status, 2);
  assert.equal(checked.stderr, "");
  const report = JSON.parse(checked.stdout) as CoreReport & {
    readonly unavailable_reason?: string;
  };
  assert.equal(report.run_outcome, "UNAVAILABLE");
  assert.equal(report.unavailable_reason, "invalid_config");
  assert.equal(report.config_digest, undefined);
  assert.deepEqual(report.results, []);
  assert.equal(existsSync(target.marker), false);
});

test("a matching release identity runs the real bundled core with an external manifest", (t) => {
  const { root, skill } = cleanAsset(t);
  const target = targetProject(t);
  const version = run(
    process.execPath,
    [join(skill, "scripts", "exit-criteria.mjs"), "--version"],
    root,
  );

  assert.equal(version.status, 0, version.stderr);
  assert.equal(version.stdout.trim(), releaseTag);

  const shown = JSON.parse(showConfig(skill, target).stdout) as ShownConfig;
  const execution = runSkill(skill, target);
  assert.equal(execution.status, 0, execution.stderr);
  assert.equal(execution.stderr, "checker diagnostic\n");
  const report = JSON.parse(execution.stdout) as CoreReport;
  assert.equal(report.run_outcome, "PASS");
  assert.match(report.config_digest ?? "", /^sha256:[a-f0-9]{64}$/u);
  assert.equal(report.config_digest, shown.config_digest);
  assert.deepEqual(report.results, [
    { criterion_id: "release_core", text: "The bundled core runs from a standalone Skill", outcome: "PASS", exit_code: 0 },
  ]);
  assert.equal(existsSync(target.marker), true);
  assert.deepEqual(readdirSync(target.root), []);
});

test("a version mismatch fails before core and emits no report", (t) => {
  const { skill } = cleanAsset(t);
  const target = targetProject(t);
  const skillPath = join(skill, "SKILL.md");
  const source = readFileSync(skillPath, "utf8");
  writeFileSync(skillPath, source.replace(releaseTag, "v0.0.0-mismatch"), "utf8");

  const execution = runSkill(skill, target);
  assert.equal(execution.status, 2);
  assert.equal(execution.stdout, "");
  assert.match(execution.stderr, /^PACKAGE ERROR .*version mismatch/u);
  assert.doesNotMatch(execution.stderr, /config_digest|run_outcome/u);
  assert.equal(existsSync(target.marker), false);
});

test("a missing SKILL.md fails before core and emits no report", (t) => {
  const { skill } = cleanAsset(t);
  const target = targetProject(t);
  rmSync(join(skill, "SKILL.md"));

  const execution = runSkill(skill, target);
  assert.equal(execution.status, 2);
  assert.equal(execution.stdout, "");
  assert.match(execution.stderr, /^PACKAGE ERROR .*cannot read SKILL\.md/u);
  assert.doesNotMatch(execution.stderr, /config_digest|run_outcome/u);
  assert.equal(existsSync(target.marker), false);
});

test("a missing metadata.version fails before core and emits no report", (t) => {
  const { skill } = cleanAsset(t);
  const target = targetProject(t);
  const skillPath = join(skill, "SKILL.md");
  const source = readFileSync(skillPath, "utf8");
  const withoutVersion = source.replace(/^  version:.*\n/mu, "");
  assert.notEqual(withoutVersion, source);
  writeFileSync(skillPath, withoutVersion, "utf8");

  const execution = runSkill(skill, target);
  assert.equal(execution.status, 2);
  assert.equal(execution.stdout, "");
  assert.match(execution.stderr, /^PACKAGE ERROR .*metadata\.version is missing/u);
  assert.doesNotMatch(execution.stderr, /config_digest|run_outcome/u);
  assert.equal(existsSync(target.marker), false);
});
