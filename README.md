# Exit Criteria

> **Development preview:** source checkout only. The npm package is private and
> unpublished, and there is no supported release or tag yet. Do not use `npx`
> or assume a global `exit-criteria` command.

> **Replace an AI's “done” with executed check results.**

Exit Criteria is a small, tool-neutral acceptance gate. Put the checks required
to call an artifact complete in one file, run one command, and receive the same
`PASS`, `FAIL`, or `UNAVAILABLE` report locally, in CI, or from an agent.

It does not replace test runners, spreadsheet validators, PDF inspectors, or
other domain tools. It runs those tools through one manifest and gives their
results one versioned machine-readable shape.

## Example

In the target project, create `exit-criteria.yml`:

```yaml
version: 1
criteria:
  workbook_opens:
    text: The workbook opens successfully
    argv: ["python", "checks/workbook_opens.py", "report.xlsx"]

  totals_match:
    text: Report totals match the source data
    argv: ["python", "checks/totals_match.py", "report.xlsx", "source.csv"]
    timeout_seconds: 60
```

Run the built CLI from a reviewed source checkout. Make the target root
explicit:

```console
$ node /absolute/path/to/exit-criteria/dist/src/cli.js check --repo-root /absolute/path/to/target-project --config exit-criteria.yml
config: sha256:0c8d...
PASS        totals_match  (exit 0)
            Report totals match the source data
PASS        workbook_opens  (exit 0)
            The workbook opens successfully

run: PASS
```

Add `--json` for the versioned automation contract. The built CLI also accepts
`--config PATH`, `--repo-root PATH`, `-h|--help`, and `-v|--version`.

## Manifest version 1

The normative shape is [the manifest version 1 JSON Schema](schemas/manifest-v1.schema.json).
The input file is YAML with this contract:

- The document and every nested mapping use string keys only. Duplicate keys
  and unknown top-level or criterion fields are rejected.
- `version` is the integer `1`.
- `criteria` is a non-empty mapping. Each key is a unique, non-empty criterion
  ID. IDs and all other string values must contain valid Unicode.
- Each criterion requires non-blank string `text` and a non-empty string array
  `argv`. Arguments are passed directly with `shell: false`; shell command
  strings are not accepted.
- `cwd` is an optional non-empty relative string. Its default is `.`. It is
  normalized lexically against `--repo-root`, treating both `/` and `\` as path
  separators; an absolute path or `..` escape is rejected. Symlinks are not
  resolved, so this is not a sandbox or filesystem isolation boundary.
- `timeout_seconds` is an optional finite number greater than `0` and no greater
  than `2147483.647`. Its default is `300`.

The manifest file is read as UTF-8. Criteria are independent acceptance checks:
they must not communicate through, or rely on, their execution order. Exit
Criteria does not promise a scheduling order and may change how checks are
scheduled. Report results are sorted by criterion ID in ascending UTF-16 code
unit order. Consumers must not infer execution, dependency, or priority
semantics from that presentation order.

A relative `--config` path is resolved against `--repo-root`. Absolute paths
and `..` segments are permitted, so the resolved config path may be outside the
target root. This is intentional for a trusted, caller-owned manifest. Unlike
a criterion `cwd`, the config path is not root-constrained and does not convert
backslashes to separators. Neither path rule sandboxes the commands declared
by the manifest.

## Outcomes and reports

| Outcome | Exit code | Meaning |
|---|---:|---|
| `PASS` | 0 | Every declared criterion passed |
| `FAIL` | 1 | At least one criterion ran and failed, and none was unavailable |
| `UNAVAILABLE` | 2 | A check could not run, timed out, was terminated by a signal, or the configuration could not be evaluated |

`UNAVAILABLE` dominates `FAIL`; an unknown is never counted as a pass. An empty
criteria set is invalid. A handled run with a valid manifest evaluates every
declared criterion and represents each one exactly once in `results`, even when
another criterion fails or is unavailable.

JSON report version 2 is the versioned machine contract. Its normative shape is
[the report version 2 JSON Schema](schemas/report-v2.schema.json). A normal
completed report looks like this:

```json
{
  "tool": "exit-criteria",
  "report_version": 2,
  "config_digest": "sha256:0c8d000000000000000000000000000000000000000000000000000000000000",
  "run_outcome": "FAIL",
  "results": [
    {
      "criterion_id": "totals_match",
      "text": "Report totals match the source data",
      "outcome": "FAIL",
      "exit_code": 1
    },
    {
      "criterion_id": "workbook_opens",
      "text": "The workbook opens successfully",
      "outcome": "PASS",
      "exit_code": 0
    }
  ]
}
```

The root fields `tool`, `report_version`, `run_outcome`, and `results` are always
present in a handled JSON report. `config_digest` is present only when the
manifest is valid. A configuration-level `UNAVAILABLE` has an empty `results`
array, root `unavailable_reason` of `config_unavailable` or `invalid_config`,
and a root `message`.

Every result has `criterion_id`, `text`, and `outcome`. A `PASS` or `FAIL`
result has numeric `exit_code`. An `UNAVAILABLE` result has no invented exit
code and instead has `unavailable_reason`: `spawn_failed`, `timeout`, or
`terminated_by_signal`.

With `--json`, handled check and configuration outcomes are written as JSON to
stdout. Help and version are informational output, exit `0`, and are not
reports. Usage errors and unexpected internal errors write a diagnostic to
stderr, exit `2`, and do not produce JSON. If the CLI itself receives `SIGINT`
or `SIGTERM`, it can terminate with that signal and no JSON report.

Without `--json`, the human report is informational, not versioned, and must
not be machine-parsed. In human reports and Exit Criteria-generated diagnostics,
backslashes, control and format characters, and Unicode line and paragraph
separators in dynamic values are escaped so they stay on one physical line.
Output forwarded from checkers is not rewritten.

Report output uses stdout. Both stdout and stderr from each checker are
forwarded to the CLI's stderr, and checker stdin is ignored. Checkers must be
non-interactive and stay in the foreground until their work and child
processes finish.

On supported platforms, Exit Criteria manages only the directly started
process. If a checker leaves a background process holding stdout or stderr,
Exit Criteria closes its pipe ends and returns `UNAVAILABLE` at
`timeout_seconds`; it does not supervise or terminate the descendant process
tree.

## Configuration identity

Every report for a valid manifest includes `config_digest` in
`sha256:<lowercase hex>` form. It identifies the normalized configuration that
was evaluated, including criterion IDs and text, argv, normalized working
directories, timeouts, and expanded defaults. YAML comments, whitespace, key
order, and explicit default values do not change it.

The digest does not include the repository root, config path, `PATH` or other
environment variables, the resolved executable, checker bytes, the Exit
Criteria revision, artifact bytes or revision, or report authenticity. It also
does not prove that criteria were fixed before work began.

The caller owns recording and comparing an expected digest. When identity or
provenance matters, the caller also binds the report to the exact Exit Criteria
revision, target artifact or revision, and execution context.

## Responsibility boundary

Exit Criteria evaluates the criteria it is given. The caller owns their
approval, storage, enforcement, and any policy that decides which digest is
trusted. The core has no runtime dependency on Git, GitHub, an issue tracker,
CI, or a language model.

The core is limited to parsing one flat local manifest, running direct
foreground commands, aggregating outcomes, and returning a report. It does not
contain domain profiles, a registry, profile installation or composition,
workflow state, remediation, artifact storage, an HTTP service, MCP, or a
plugin loader. See [DESIGN.md](DESIGN.md) for the binding boundary.

The configuration can run arbitrary executables available to the process.
`shell: false` prevents shell-string interpretation; it does not sandbox a
trusted argv array. Do not run an untrusted criteria file.

Passing means only that the declared criteria passed. Weak or incomplete
criteria produce weak assurance. Exit Criteria does not prove that an artifact
is correct, that an agent invoked the CLI, or that the report describes the
artifact bytes a caller intends to accept.

Development and pull request guidance is in [CONTRIBUTING.md](CONTRIBUTING.md).
Report security vulnerabilities through the private route in
[SECURITY.md](SECURITY.md), not a public issue.

## Manual source runbook

The source checkout requires Node.js 20 or later. Pin a reviewed full commit,
not a moving branch, then install from the lock file and test that exact
checkout:

```console
git clone https://github.com/agent-operated/exit-criteria.git /absolute/path/to/exit-criteria
cd /absolute/path/to/exit-criteria
git switch --detach REVIEWED_FULL_COMMIT_SHA
git rev-parse HEAD
npm ci
npm test
```

Before accepting a target, the caller records the reviewed Exit Criteria full
commit, the target identity or revision, and the expected config digest. Keep
evidence outside the target because shell redirection creates files before the
check starts and could otherwise change the artifact being evaluated.

```console
mkdir -p /absolute/path/to/caller-evidence
git -C /absolute/path/to/exit-criteria rev-parse HEAD > /absolute/path/to/caller-evidence/exit-criteria-commit.txt
git -C /absolute/path/to/target-project rev-parse HEAD > /absolute/path/to/caller-evidence/target-revision.txt
printf '%s\n' 'sha256:EXPECTED_DIGEST' > /absolute/path/to/caller-evidence/expected-config-digest.txt

if node /absolute/path/to/exit-criteria/dist/src/cli.js check \
  --repo-root /absolute/path/to/target-project \
  --config exit-criteria.yml \
  --json \
  > /absolute/path/to/caller-evidence/report.json \
  2> /absolute/path/to/caller-evidence/checker.log
then
  ec_status=0
else
  ec_status=$?
fi
printf '%s\n' "$ec_status" > /absolute/path/to/caller-evidence/exit-status.txt
```

Use a Git revision as the target identity only when the accepted artifact
matches that committed tree. Otherwise, including for a non-Git target, record
an equivalent immutable artifact identity. Compare the expected digest with
`config_digest` in `report.json`. The commit, target identity, expected digest,
JSON, stderr, and numeric status remain separate caller-owned records; Exit
Criteria does not turn them into an attestation or claim their authenticity.

## Supported platforms

The development preview supports macOS and Linux. Windows is not supported.
The CLI does not block execution on Windows, but Windows behavior is outside
the supported contract.

## License

[MIT](LICENSE)

---

# Exit Criteria（日本語）

> **開発preview:** source checkoutからだけ利用できます。npm packageはprivateで
> 未公開です。対応releaseやtagもまだありません。`npx`やglobalにinstall済みの
> `exit-criteria` commandを前提にしないでください。

> **AIの「完成しました」を、実行された検査結果に置き換える。**

Exit Criteriaは、特定のagentや成果物に依存しない小さなacceptance gateです。
成果物を完了と呼ぶために必要な検査を一つのfileへ書き、一つのcommandで実行すると、
local、CI、agentのどこからでも同じ`PASS`、`FAIL`、`UNAVAILABLE`のreportを得られます。

test runner、Excel検査、PDF検査などを置き換えるものではありません。領域ごとの既存の
検査toolを一つのmanifestから実行し、結果をversion付きの同じ機械可読形式へまとめます。

## 例

対象projectに`exit-criteria.yml`を作成します。

```yaml
version: 1
criteria:
  workbook_opens:
    text: Excel fileが正常に開く
    argv: ["python", "checks/workbook_opens.py", "report.xlsx"]

  totals_match:
    text: 集計値が元dataと一致する
    argv: ["python", "checks/totals_match.py", "report.xlsx", "source.csv"]
    timeout_seconds: 60
```

review済みsource checkoutのbuild済みCLIを使います。対象rootを明示してください。

```console
$ node /absolute/path/to/exit-criteria/dist/src/cli.js check --repo-root /absolute/path/to/target-project --config exit-criteria.yml
config: sha256:0c8d...
PASS        totals_match  (exit 0)
            集計値が元dataと一致する
PASS        workbook_opens  (exit 0)
            Excel fileが正常に開く

run: PASS
```

version付きの自動処理contractには`--json`を追加します。CLIは`--config PATH`、
`--repo-root PATH`、`-h|--help`、`-v|--version`も受け付けます。

## Manifest version 1

正本となる形式は[manifest version 1 JSON Schema](schemas/manifest-v1.schema.json)です。
入力fileは、次のcontractを持つYAMLです。

- documentと入れ子の全mappingで、keyはstringだけです。重複key、top-levelまたは
  criterionの未知fieldは拒否します。
- `version`は整数`1`です。
- `criteria`は空でないmappingです。各keyは一意で空でないcriterion IDです。
  IDを含む全string値は正しいUnicodeでなければなりません。
- 各criterionには、空白だけではないstring `text`と、空でないstring配列`argv`が必要です。
  引数は`shell: false`で直接渡します。shell command文字列は受け付けません。
- `cwd`は任意の空でないrelative stringで、既定値は`.`です。`--repo-root`を基準に
  `/`と`\`をどちらもseparatorとして扱い、字句的に正規化します。absolute pathとroot外へ
  出る`..`は拒否します。symlinkの実体は解決しないため、sandboxやfilesystem isolationの
  境界ではありません。
- `timeout_seconds`は任意の有限numberです。`0`より大きく`2147483.647`以下でなければ
  なりません。既定値は`300`です。

manifest fileはUTF-8として読みます。各criterionは独立したacceptance checkです。
criterion同士が実行順を使って通信したり、特定の実行順へ依存したりしてはいけません。
Exit Criteriaはschedule順を保証せず、将来変更できます。reportのresultはcriterion IDを
UTF-16 code unitの昇順で並べます。callerは、この表示順から実行順、依存関係、優先度の意味を
読み取ってはいけません。

relativeな`--config` pathは`--repo-root`を基準に解決します。absolute pathと`..` segmentを
許可するため、解決後のconfig pathは対象root外になり得ます。これは信頼済みでcaller所有の
manifestを使うための意図した挙動です。criterionの`cwd`とは異なり、config pathはroot内へ
制限されず、backslashをseparatorへ変換しません。どちらのpath規則も、manifestが宣言する
commandをsandboxへ閉じ込めません。

## 判定とreport

| outcome | exit code | 意味 |
|---|---:|---|
| `PASS` | 0 | 宣言された全criteriaが成功した |
| `FAIL` | 1 | 一件以上が失敗し、`UNAVAILABLE`はなかった |
| `UNAVAILABLE` | 2 | 起動不能、timeout、signal終了、または設定不備により完全な判定ができなかった |

`UNAVAILABLE`は`FAIL`より優先されます。不明を成功として扱いません。criteriaが0件の設定は
不正です。有効なmanifestを最後まで扱えたrunでは、別のcriterionが失敗または実行不能でも、
宣言された全criterionを評価し、各criterionを`results`へ一度ずつ入れます。

JSON report version 2が、version付きのmachine contractです。正本となる形式は
[report version 2 JSON Schema](schemas/report-v2.schema.json)です。通常の完了reportは次の形です。

```json
{
  "tool": "exit-criteria",
  "report_version": 2,
  "config_digest": "sha256:0c8d000000000000000000000000000000000000000000000000000000000000",
  "run_outcome": "FAIL",
  "results": [
    {
      "criterion_id": "totals_match",
      "text": "集計値が元dataと一致する",
      "outcome": "FAIL",
      "exit_code": 1
    },
    {
      "criterion_id": "workbook_opens",
      "text": "Excel fileが正常に開く",
      "outcome": "PASS",
      "exit_code": 0
    }
  ]
}
```

扱えるJSON reportでは、root fieldの`tool`、`report_version`、`run_outcome`、`results`が
常に存在します。`config_digest`はmanifestが有効な場合だけ存在します。設定levelの
`UNAVAILABLE`では、`results`は空配列です。rootの`unavailable_reason`は
`config_unavailable`または`invalid_config`で、rootに`message`も入ります。

各resultは`criterion_id`、`text`、`outcome`を持ちます。`PASS`または`FAIL`にはnumericな
`exit_code`が入ります。`UNAVAILABLE`に架空のexit codeは入らず、代わりに
`unavailable_reason`として`spawn_failed`、`timeout`、`terminated_by_signal`のいずれかが
入ります。

`--json`指定時は、扱える検査結果と設定結果をJSONとしてstdoutへ出します。helpとversionは
exit `0`の情報表示であり、reportではありません。usage errorと予期しない内部errorは診断を
stderrへ出し、JSONなしのexit `2`で終了します。CLI自身が`SIGINT`または`SIGTERM`を受けると、
JSON reportを出さず同じsignalで終了する場合があります。

`--json`なしのhuman reportは情報表示であり、version付きcontractではありません。
machine parseしないでください。human reportとExit Criteria自身が生成する診断では、動的な値に
含まれるbackslash、control character、format character、Unicodeのline separatorと
paragraph separatorをescapeし、一つの物理行へ保ちます。checkerから転送される出力は
書き換えません。

reportはstdoutへ出します。各checkerのstdoutとstderrは、どちらもCLIのstderrへ転送します。
checkerのstdinは無視します。checkerはnon-interactiveでなければならず、自身の処理と子processが
終わるまでforegroundに残る必要があります。

対応OSでExit Criteriaが管理するのは、直接起動したprocessだけです。checkerが背景processに
stdoutまたはstderrを保持させた場合、Exit Criteriaは`timeout_seconds`でpipeを閉じて
`UNAVAILABLE`を返しますが、子孫process treeを監視または終了しません。

## 評価した設定の識別

有効なmanifestに対するreportには、`sha256:<lowercase hex>`形式の`config_digest`が入ります。
これはcriterion IDと文章、argv、正規化した作業directory、timeout、展開済み既定値を含む、
実際に評価した正規化済み設定を識別します。YAMLのcomment、空白、key順、既定値を明記したか
どうかでは変わりません。

digestには、repository root、config path、`PATH`などの環境変数、解決後の実行file、checkerの
bytes、Exit Criteriaのrevision、artifactのbytesやrevision、reportの真正性は含まれません。
criteriaが作業前に固定されていたことも証明しません。

期待するdigestの記録と比較はcallerが担います。識別や来歴が必要な場合は、reportを正確な
Exit Criteria revision、対象artifactまたはrevision、実行contextへ結び付ける責任もcallerに
あります。

## 責任の境界

Exit Criteriaは、与えられたcriteriaを評価します。criteriaの承認、保存、実行強制、
どのdigestを信頼するかはcallerが担います。coreはGit、GitHub、Issue tracker、CI、
言語モデルをruntime要件にしません。

coreは、一つのflatなlocal manifestのparse、直接foreground commandの実行、outcome集約、
report返却だけに限定します。domain profile、registry、profileのinstallや合成、workflow state、
修復、artifact保存、HTTP service、MCP、plugin loaderは持ちません。拘束力のある境界は
[DESIGN.md](DESIGN.md)を参照してください。

設定には任意の実行fileを指定できます。`shell: false`はshell文字列の解釈を防ぎますが、
argvをsandboxへ閉じ込めるものではありません。信頼できないcriteria fileを実行しないでください。

`PASS`が保証するのは、宣言されたcriteriaが成功したことだけです。criteriaが弱い、または
不足していれば保証も弱くなります。Exit Criteriaは成果物の正しさ、agentが実際にCLIを
起動したこと、reportがcallerの受理対象bytesを記述していることを証明しません。

開発とpull requestの手順は[CONTRIBUTING.md](CONTRIBUTING.md)にあります。security vulnerabilityは
public Issueへ書かず、[SECURITY.md](SECURITY.md)に記載したprivate経路で報告してください。

## Sourceからの手動導入runbook

source checkoutにはNode.js 20以上が必要です。moving branchではなくreview済みのfull commitへ
固定し、その正確なcheckoutへlock fileからdependencyを導入してtestします。

```console
git clone https://github.com/agent-operated/exit-criteria.git /absolute/path/to/exit-criteria
cd /absolute/path/to/exit-criteria
git switch --detach REVIEWED_FULL_COMMIT_SHA
git rev-parse HEAD
npm ci
npm test
```

対象を受理する前に、review済みExit Criteriaのfull commit、対象のidentityまたはrevision、
期待するconfig digestをcallerが記録します。evidenceは対象の外へ置いてください。shellは
検査開始前にredirect先fileを作るため、対象内へ置くと評価対象そのものを変える可能性があります。

```console
mkdir -p /absolute/path/to/caller-evidence
git -C /absolute/path/to/exit-criteria rev-parse HEAD > /absolute/path/to/caller-evidence/exit-criteria-commit.txt
git -C /absolute/path/to/target-project rev-parse HEAD > /absolute/path/to/caller-evidence/target-revision.txt
printf '%s\n' 'sha256:EXPECTED_DIGEST' > /absolute/path/to/caller-evidence/expected-config-digest.txt

if node /absolute/path/to/exit-criteria/dist/src/cli.js check \
  --repo-root /absolute/path/to/target-project \
  --config exit-criteria.yml \
  --json \
  > /absolute/path/to/caller-evidence/report.json \
  2> /absolute/path/to/caller-evidence/checker.log
then
  ec_status=0
else
  ec_status=$?
fi
printf '%s\n' "$ec_status" > /absolute/path/to/caller-evidence/exit-status.txt
```

受理するartifactがcommit済みtreeと一致する場合だけ、Git revisionを対象identityに使います。
一致しない場合やGit管理外の場合は、同等の変更不能なartifact identityを記録してください。
事前に記録したdigestと`report.json`の`config_digest`を比較します。commit、対象identity、
期待digest、JSON、stderr、numeric statusはcaller所有の別々の記録です。Exit Criteriaは
これらをattestationへ変換せず、真正性も主張しません。

## 対応OS

開発previewの対応OSはmacOSとLinuxです。Windowsは未対応です。CLIはWindowsでの実行自体を
拒否しませんが、Windowsでの挙動はcontract対象外です。

## ライセンス

[MIT](LICENSE)
