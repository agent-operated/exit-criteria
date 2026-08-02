## 未決定事項

Exit CriteriaのCLIが、評価結果と評価不能をどのexit codeおよびmachine-readable outputで表すか。

## 採用した手段

CLIは`exit-criteria check`で既定の`exit-criteria.yml`を全件評価する。criteria reportを伴う
exit code `0`は全件`PASS`、一件以上の`FAIL`があり`UNAVAILABLE`がない場合は`1`、一件以上の
`UNAVAILABLE`、空の評価、無効な設定、または扱える実行不能は`2`とする。`UNAVAILABLE`は
`FAIL`より優先する。有効なmanifestを最後まで扱えたrunでは、全criterionを評価し、各criterionを
machine reportへ一度ずつ入れる。criterionの実行順は保証しないが、reportのresultはcriterion
IDのUTF-16 code unit昇順に固定する。callerは、この表示順から実行順、依存関係、優先度の
意味を読み取らない。

version付きmachine contractはJSON report version 2とする。rootは`tool`、`report_version`、
`run_outcome`、`results`を常に持つ。有効なmanifestでは`config_digest`も持つ。各resultは
`criterion_id`、`text`、`outcome`を持つ。`PASS`と`FAIL`はnumericな`exit_code`を持つ。
`UNAVAILABLE`はexit codeを作らず、`unavailable_reason`として`spawn_failed`、`timeout`、
`terminated_by_signal`のいずれかを持つ。設定levelの`UNAVAILABLE`はempty `results`、rootの
`unavailable_reason`として`config_unavailable`または`invalid_config`、および`message`を持ち、
`config_digest`を持たない。

`--json`指定時は、扱える設定errorと実行不能を含むcheck outcomeをJSONとしてstdoutへ出す。
checkerのstdoutとstderrはCLIのstderrへ転送し、checkerのstdinは無視する。direct core CLIの
`-h|--help`はcriteriaを評価せず、情報をstdoutへ出してexit code `0`を返す。direct core CLIは
release artifactではないため`-v|--version`を持たず、bareな`help`と`version`もsubcommandとして
受け付けない。standalone Skill runnerのrelease version照合は`skill-core-version-coupling.md`が所有する。
usage errorと予期しない内部障害はstderrへ出し、
exit code `2`とする。CLI自身が`SIGINT`または`SIGTERM`を受けた場合は、activeな直接processを
終了させて同じsignalで終了する。情報表示、usage error、内部障害、CLI自身のsignal終了では
JSON reportを保証しない。

人間向けtext reportはversion付きmachine contractにせず、machine parse対象にしない。text
reportとExit Criteria自身が生成する診断の動的な値は、backslash、control character、
format character、Unicode line separator、paragraph separatorをescapeし、一つの物理行へ
保つ。checkerからstderrへ転送する出力は書き換えない。

checkerの直接processがexit code `0`で終了しても、foreground contractに違反した背景processが
stdoutまたはstderrを保持している間は完走としない。`timeout_seconds`でpipeを閉じて
`UNAVAILABLE`とする。子孫processの終了は保証しない。

## 変更履歴

- [PR #19](https://github.com/agent-operated/exit-criteria/pull/19)で、standalone Skill directoryだけを
  release artifactとする境界に合わせ、direct core CLIから
  npm package versionを示していた`-v|--version`を削除した。
- [PR #10](https://github.com/agent-operated/exit-criteria/pull/10)で、report version 1の
  `conditions[].condition_id`はcriteria manifestの語彙と一致しなかったため、
  対応release前にversion 2の`results[].criterion_id`へ修正し、version 1 aliasは残さなかった。
- [PR #10](https://github.com/agent-operated/exit-criteria/pull/10)で、JSON reportの必須field、
  optional field、closed reason、出力envelope、result順を固定した。
- [PR #10](https://github.com/agent-operated/exit-criteria/pull/10)で、人間向けtextを非version contractとし、
  動的な制御文字を一行へescapeする境界を固定した。
- [PR #8](https://github.com/agent-operated/exit-criteria/pull/8)で、初見利用の検証を受け、
  criteria reportを伴うexit codeと情報表示commandのexit codeを区別した。
- [PR #8](https://github.com/agent-operated/exit-criteria/pull/8)で、背景processが診断pipeを保持する
  checkerは、直接processのexit codeだけで`PASS`にしないことを明記した。
- [PR #8](https://github.com/agent-operated/exit-criteria/pull/8)で、platform別process tree管理を廃止し、
  foreground contract違反時もCLIだけをtimeoutで完了させる境界へ変更した。
- [PR #8](https://github.com/agent-operated/exit-criteria/pull/8)で、情報表示を標準的なhelpおよび
  version flagへ限定し、未記載のbare subcommandを削除した。
