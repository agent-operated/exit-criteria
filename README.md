# Exit Criteria

> **Replace an AI's “done” with executed check results.**

Exit Criteria is a small, tool-neutral acceptance gate. Put the checks required
to call an artifact complete in one file, run one command, and receive the same
`PASS`, `FAIL`, or `UNAVAILABLE` report locally, in CI, or from an agent.

It does not replace test runners, spreadsheet validators, PDF inspectors, or
other domain tools. It runs those tools through one manifest and gives their
results one machine-readable shape.

Reusable domain criteria and checker assets belong in separate **criteria
profile** repositories. The core does not discover, download, install, merge,
or trust profiles. A caller selects and pins a profile, then supplies a flat
local manifest to Exit Criteria.

## Example

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

```console
$ exit-criteria check
config: sha256:0c8d...
PASS        totals_match  (exit 0)
            Report totals match the source data
PASS        workbook_opens  (exit 0)
            The workbook opens successfully

run: PASS
```

Use `--json` for automation:

```console
exit-criteria check --json
```

The built CLI also accepts `--config PATH`, `--repo-root PATH`, `-h|--help`, and
`-v|--version`. Commands are always argv arrays and run with `shell: false`;
shell command strings are not accepted.

## Supported platforms

The initial release supports macOS and Linux. Windows is not supported. The CLI
does not block execution on Windows, but Windows behavior is outside the
supported contract.

## Outcomes

| Outcome | Exit code | Meaning |
|---|---:|---|
| `PASS` | 0 | Every declared criterion passed |
| `FAIL` | 1 | At least one criterion ran and failed, and none was unavailable |
| `UNAVAILABLE` | 2 | A check could not run, timed out, or the configuration could not be evaluated |

An empty criteria set is invalid and never passes. With `--json`, handled
configuration errors and unavailable checks are returned as a versioned JSON
report rather than disappearing into an empty success.

A checker must stay in the foreground until its work and child processes are
finished. On supported platforms, Exit Criteria manages only the directly
started process. If a checker violates this contract and leaves a background
process holding stdout or stderr, Exit Criteria closes its pipe ends and
returns `UNAVAILABLE` at `timeout_seconds`; it does not supervise or terminate
the descendant process tree.

## Configuration identity

Every valid report includes `config_digest` in `sha256:<lowercase hex>` form.
It identifies the effective configuration that was actually evaluated,
including criterion text, argv, working directory, timeout, and expanded
defaults. YAML comments, whitespace, key order, and explicit default values do
not change it.

The digest lets a caller compare reports or pin an expected configuration. Exit
Criteria does not store or compare previous digests itself.

The digest does not prove that criteria were fixed before work began. When that
policy is required, the caller records the expected digest before work and
compares it with the digest in the report.

## Responsibility boundary

Exit Criteria evaluates the criteria it is given. The caller owns their
approval, storage, enforcement, and any policy that decides which digest is
trusted. The core has no runtime dependency on Git, GitHub, an issue tracker,
CI, or a language model.

The core is deliberately limited to parsing one flat local manifest, running
direct foreground commands, aggregating outcomes, and returning a report. It
does not contain domain profiles, a registry, profile installation or
composition, workflow state, remediation, artifact storage, an HTTP service,
MCP, or a plugin loader. Features at those layers belong in caller-owned tools,
profile repositories, or optional adapters. See [DESIGN.md](DESIGN.md) for the
boundary that must be changed before any such capability enters core.

The configuration can run arbitrary executables available to the process.
`shell: false` prevents shell-string interpretation; it does not sandbox a
trusted argv array. Do not run an untrusted criteria file.

Passing means only that the declared criteria passed. Weak or incomplete
criteria produce weak assurance, and an agent may optimize what is measured at
the expense of what is not. Exit Criteria does not prove that an artifact is
correct, and it does not prove that an agent actually invoked the CLI. A caller
such as CI can require the report when enforcement is needed. A report also
does not identify the artifact bytes it evaluated; the caller must bind the
report to an artifact or revision when that identity matters.

## Status

The CLI is implemented in this repository but the npm package is not published.
Build and run it locally with:

```console
npm run build
node dist/src/cli.js check
```

## License

[MIT](LICENSE)

---

# Exit Criteria（日本語）

> **AIの「完成しました」を、実行された検査結果に置き換える。**

Exit Criteriaは、特定のagentや成果物に依存しない小さなacceptance gateです。
成果物を完了と呼ぶために必要な検査を一つのfileへ書き、一つのcommandで実行すると、
local、CI、agentのどこからでも同じ`PASS`、`FAIL`、`UNAVAILABLE`のreportを得られます。

test runner、Excel検査、PDF検査などを置き換えるものではありません。領域ごとの既存の
検査toolを一つのmanifestから実行し、結果を同じ機械可読形式へまとめます。

再利用可能なdomain criteriaとchecker資産は、coreとは別の**criteria profile** repositoryが
所有します。coreはprofileを検索、download、install、merge、trustしません。呼び出し側が
profileを選択してversionを固定し、flatなlocal manifestとしてExit Criteriaへ渡します。

## 例

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

```console
exit-criteria check
exit-criteria check --json
```

CLIは`--config PATH`、`--repo-root PATH`、`-h|--help`、`-v|--version`も受け付けます。
commandは必ずargv配列で指定し、`shell: false`で実行します。shell command文字列は
受け付けません。

## 対応OS

初期releaseの対応OSはmacOSとLinuxです。Windowsは未対応です。CLIはWindowsでの実行自体を
拒否しませんが、Windowsでの挙動は動作保証の対象外です。

## 判定

| outcome | exit code | 意味 |
|---|---:|---|
| `PASS` | 0 | 宣言された全criteriaが成功した |
| `FAIL` | 1 | 一件以上が失敗し、`UNAVAILABLE`はなかった |
| `UNAVAILABLE` | 2 | 起動不能、timeout、または設定不備により完全な判定ができなかった |

criteriaが0件の設定は不正であり、成功にはなりません。`--json`指定時は、扱える設定
errorや検査不能もversion付きJSON reportとして返します。

checkerは、自身の作業と子processが完了するまでforegroundに残る必要があります。対応OSで
Exit Criteriaが管理するのは、直接起動したprocessだけです。checkerがこのcontractに
違反して背景processにstdoutまたはstderrを保持させた場合、Exit Criteriaは
`timeout_seconds`でpipeを閉じて`UNAVAILABLE`を返しますが、子孫processの終了は管理しません。

## 評価した設定の識別

有効なreportには`sha256:<lowercase hex>`形式の`config_digest`が入ります。これは、
criterionの文章、argv、作業directory、timeout、展開済み既定値を含む、実際に評価した
設定を識別します。YAMLのcomment、空白、key順、既定値を明記したかどうかでは変わりません。

呼び出し側はdigestを使って過去reportとの比較や期待する設定の固定ができます。
Exit Criteria自身は、過去digestの保存や比較を行いません。

digestは、criteriaが作業前に固定されていたことを証明しません。そのpolicyが必要な場合は、
呼び出し側が作業前に期待するdigestを記録し、reportのdigestと比較します。

## 責任の境界

Exit Criteriaは、与えられたcriteriaを評価します。criteriaの承認、保存、実行強制、
どのdigestを信頼するかは呼び出し側が担います。coreはGit、GitHub、Issue tracker、CI、
言語モデルをruntime要件にしません。

coreは、一つのflatなlocal manifestのparse、直接foreground commandの実行、outcome集約、
report返却だけに限定します。domain profile、registry、profileのinstallや合成、workflow
state、修復、artifact保存、HTTP service、MCP、plugin loaderは持ちません。それらは呼び出し側、
profile repository、または任意adapterが担います。この境界を越える実装より先に変更すべき
設計は[DESIGN.md](DESIGN.md)にあります。

設定には任意の実行fileを指定できます。`shell: false`はshell文字列の解釈を防ぎますが、
argvをsandboxへ閉じ込めるものではありません。信頼できないcriteria fileを実行しないでください。

`PASS`が保証するのは、宣言されたcriteriaが成功したことだけです。criteriaが弱い、または
不足していれば保証も弱くなります。agentは測定対象だけを満たし、対象外を犠牲にすることも
できます。Exit Criteriaは成果物の正しさや、agentが実際にCLIを起動したことを証明しません。
また、report単体では、どの内容の成果物を評価したかを識別しません。その識別が必要な場合は、
呼び出し側がreportを成果物またはrevisionへ結び付けます。強制が必要な場合は、CIなどの
呼び出し側がreportを必須にします。

## 現在の状態

CLIはこのrepositoryに実装されていますが、npm packageは未公開です。

```console
npm run build
node dist/src/cli.js check
```

## ライセンス

[MIT](LICENSE)
