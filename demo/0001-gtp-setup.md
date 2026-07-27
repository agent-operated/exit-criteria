# Demo 0001 — GTP 1.0.4 setup

Exit Criteria did not exist when this task ran. The flow was simulated by hand and the
results were measured for real. Recorded so the design can be corrected from evidence
rather than from intention.

- Task: install GTP 1.0.4 into this repository
- Date: 2026-07-27
- Merged by: machine, after every merge gate passed
- GTP under test: `1.0.4` (unreleased at the time), Record protocol `1.1`

---

## Simulated

What Exit Criteria should have printed. Default locale is `en`; the `ja` rendering is
shown alongside because the operator reads Japanese.

**en**

```text
you: install GTP 1.0.4 into this repository

exit-criteria: define the exit criteria

  1. GTP.md matches the 1.0.4 specification byte for byte   (recommended)
  2. the adapter paragraph is included verbatim             (recommended)
  3. the changed files are exactly what was declared        (recommended)
  4. nothing unsafe to publish appears in the diff          (recommended)
  5. gtp 1.0.4 actually runs against this repository        (recommended)
  6. other (type it)

you: all of them

exit-criteria: expanded to 9 checks and frozen.
               sha256:966673b371ec84af23701ce563a686258e1764c0e52ca0a402ee274a5424869a

               blocks merge:     EC-1..EC-7
               checked after:    EC-8
               follow-up record: EC-9
```

**ja**

```text
ユーザー: このrepositoryにGTP 1.0.4を導入して

exit-criteria: 完了条件を定義してください

  1. GTP.md が 1.0.4 仕様と byte 一致する    （推奨）
  2. adapter文が一字一句入る                 （推奨）
  3. 変更したfileが宣言どおりか               （推奨）
  4. 公開して危険な値が混ざっていないか        （推奨）
  5. gtp 1.0.4 が実際にこのrepositoryで動くか  （推奨）
  6. その他（入力）

ユーザー: 全部

exit-criteria: 9件へ展開して固定します。
               sha256:966673b371ec84af23701ce563a686258e1764c0e52ca0a402ee274a5424869a
```

The human action was one line. Everything after it was decided by machine.

---

## Frozen

`sha256:966673b371ec84af23701ce563a686258e1764c0e52ca0a402ee274a5424869a` (49 lines)

Held in a dedicated file, not embedded in prose. That choice comes from a defect found
the previous time this was attempted; see F-2 below.

Outcome vocabulary is `PASS` / `FAIL` / `UNAVAILABLE`. A check that cannot acquire its
input reports `UNAVAILABLE` and never counts as a pass.

| # | condition | gate |
|---|---|---|
| EC-1 | `GTP.md` matches the 1.0.4 specification byte for byte | merge |
| EC-2 | `AGENTS.md` contains the adapter verbatim and nothing else | merge |
| EC-3 | `CLAUDE.md` points to `AGENTS.md` and holds no instructions itself | merge |
| EC-4 | the PR's changed-file set equals the declared set | merge |
| EC-5 | the diff contains nothing unsafe to publish | merge |
| EC-6 | the PR is mergeable and its base has not moved | merge |
| EC-7 | `gtp` 1.0.4 returns a state for an issue in this repository | merge |
| EC-8 | after merge, `main` changed as expected | readback |
| EC-9 | this record exists with simulation and measurement kept apart | follow-up |

### Pinned source

```text
GTP package:     1.0.4
Record protocol: 1.1
Source commit:   92c40417ec95c94a0589b9258cd5b6949eec7a86
GTP.md sha256:   56c04bcc4104be37bde49f0c673ca67c011ff12833b03050c6d9c0170e8cb4f6
base:            main @ 9c83f3871ed31d7fd2f069c30959afa53f710485
```

`1.0.4` was not on PyPI. The specification was taken from the sdist and independently
checked against the same file at the public source commit. Both were byte-identical, so
a single corrupted path would have shown up as a mismatch.

---

## Observed

### EC-1 — GTP.md byte match

```console
$ shasum -a 256 GTP.md
56c04bcc4104be37bde49f0c673ca67c011ff12833b03050c6d9c0170e8cb4f6
```
PASS.

### EC-2 — adapter verbatim, nothing else

```console
adapter present: OK
AGENTS.md lines: 5   (limit 10)
```
PASS. The paragraph was extracted from the placed `GTP.md` by script. Its wording changed
in 1.0.4 — "4 Record" became "protocol versionに対応するRecord" — so retyping it would
have been a likely source of error.

### EC-3 — CLAUDE.md is a pointer

```console
reference present: OK
CLAUDE.md lines: 1   (limit 5)
```
PASS.

### EC-4 — changed-file set

```console
AGENTS.md,CLAUDE.md,GTP.md
```
PASS.

### EC-5 — nothing unsafe in the diff

```console
patch bytes fetched: 25681
absolute paths : 0
token prefixes : 0
private keys   : 0
```
PASS. The byte count is checked before the scan; see F-1.

### EC-6 — mergeable, base unmoved

```console
mergeable=true state=clean base=9c83f3871ed31d7fd2f069c30959afa53f710485
```
PASS.

### EC-7 — gtp 1.0.4 actually runs

```console
$ gtp --version
1.0.4
$ gtp status <issue-url>
exit=0  state=unmanaged
```
PASS. The state was observed, not fixed in advance.

### EC-8 — post-merge readback

```json
{"merged":true,"merged_by":"ao-claude[bot]","merge_commit_sha":"17eacf3a0676679117ae98d45f6015912cf76369","state":"closed"}
```
```console
main GTP.md sha256 = 56c04bcc4104be37bde49f0c673ca67c011ff12833b03050c6d9c0170e8cb4f6
main tree = .gitignore AGENTS.md CLAUDE.md GTP.md LICENSE README.md
```
PASS. No human was asked to confirm anything between freezing the criteria and the merge.

### Side observation — the 1.0.4 human-body checker

`gtp check --target issue|pr` is new in 1.0.4. It was exercised on both bodies before they
were posted.

```console
$ gtp check --target issue issue-body.md     # first attempt
exit=1  valid=false  errors=9
  invalid_first_section $.sections.目的
  missing_section       $.sections.目的 / ゴール / 現在わかっていること / 守る境界
                        / 決定事項 / 完了条件 / 未確認事項 / 人間に求める判断

$ gtp check --target issue issue-body.md     # after rewriting to the required shape
exit=0  valid=true  errors=0

$ gtp check --target pr pr-body.md           # first attempt
exit=1  valid=false  errors=8

$ gtp check --target pr pr-body.md           # after rewriting
exit=0  valid=true  errors=0
```

Both bodies were rewritten to conform before posting. The checker rejected exactly what it
documents and nothing more.

---

## Findings

### F-1 — A check can report PASS when it never received its input

Carried over from the previous attempt at this task, and fixed here.

A scan that finds nothing in an empty file looks identical to a scan that finds nothing in
a clean diff. Last time, an API call failed, its error was discarded, and the check
reported a pass over zero bytes.

The fix used in this run: every check that consumes fetched data asserts the input is
present before evaluating it, and reports a third outcome when it is not.

```text
PASS         the condition holds
FAIL         the condition does not hold
UNAVAILABLE  the input could not be acquired  ← never collapses into PASS
```

EC-5 recorded `25681` bytes fetched before scanning. That number is part of the evidence,
not a debug detail.

GTP already draws this line — an Acquisition Error is not a `halt`. Exit Criteria now draws
it too.

### F-2 — Frozen criteria belong in their own file

Also carried over. Last time the criteria were delimited inside a prose document, and the
extraction returned 115 lines instead of 21 because the surrounding text quoted the
delimiters.

This run put the criteria in a dedicated file and hashed the whole file. No markers, no
range extraction, nothing to collide with.

A matching digest still does not prove the extracted region was the intended one. Recording
the line count alongside it remains worthwhile.

### F-3 — The 1.0.4 body checker enforces Japanese section headings

`gtp check --target issue|pr` requires exact H2 headings, and those headings are Japanese:

```text
issue: 目的 | ゴール | 現在わかっていること | 守る境界 | 決定事項 | 完了条件 | 未確認事項 | 人間に求める判断
pr:    目的 | ゴール | 変更内容 | 利用者への影響 | 現在地 | 未確認事項 | 人間に求める判断
```

The specification is explicit that the checker does not judge language — only structure. So
the headings behave as protocol tokens rather than prose, and body content may be written in
any language.

That is defensible, and it is consistent with keeping machine tokens in their original form.
It still has a consequence worth stating plainly: a repository that writes English-first
public surfaces will have Issues and PRs whose section headings are Japanese. Anyone reading
this repository will see that. It is a deliberate trade, not an oversight.

### F-4 — Structure checking found real omissions, not just formatting

The first Issue body was rejected. Rewriting it to the required shape forced four sections
that had genuinely been missing: what boundary the work must not cross, which option was
rejected and why, what would justify revisiting the decision, and what the human is being
asked to decide.

The checker validates structure only. But requiring a place for those four things is not a
formatting rule — the earlier draft had simply not answered them.

### F-5 — Two independent paths are worth the extra step for unreleased input

`1.0.4` was installed from a CI artifact rather than a package index. Two things were
checked rather than one: the artifact's own manifest, and the same specification file fetched
from the public source commit. They agreed byte for byte.

If only the sdist had been trusted, a mismatch between the built artifact and the source it
claims to come from would have gone unnoticed.
