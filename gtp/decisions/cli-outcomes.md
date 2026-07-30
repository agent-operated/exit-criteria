## 未決定事項

Exit CriteriaのCLIが、評価結果と評価不能をどのexit codeおよびmachine-readable outputで表すか。

## 採用した手段

CLIは`exit-criteria check`で既定の`exit-criteria.yml`を全件評価する。criteria reportを伴うexit code `0`は全件`PASS`、一件以上の`FAIL`があり`UNAVAILABLE`がない場合は`1`、一件以上の`UNAVAILABLE`、空の評価、無効な設定、または扱える実行不能は`2`とする。checkerの直接processがexit code `0`で終了しても、foreground contractに違反した背景processがstdoutまたはstderrを保持している間は完走とせず、`timeout_seconds`でpipeを閉じて`UNAVAILABLE`とする。子孫processの終了は保証しない。`--json`指定時は、扱える設定errorと実行不能を含めてversioned JSON reportをstdoutへ出す。`-h|--help`と`-v|--version`はcriteriaを評価せず、情報をstdoutへ出してexit code `0`を返す。bareな`help`と`version`はsubcommandとして受け付けない。予期しない内部障害はstderrへ出し、exit code `2`とする。

## 変更履歴

- 初見利用の検証を受け、criteria reportを伴うexit codeと情報表示commandのexit codeを区別した。
- 背景processが診断pipeを保持するcheckerは、直接processのexit codeだけで`PASS`にしないことを明記した。
- platform別process tree管理を廃止し、foreground contract違反時もCLIだけをtimeoutで完了させる境界へ変更した。
- 情報表示を標準的なhelpおよびversion flagへ限定し、未記載のbare subcommandを削除した。
