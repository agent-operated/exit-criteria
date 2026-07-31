## 未決定事項

利用者が完了条件とその検査commandを、どの設定構造でExit Criteriaへ渡すか。

## 採用した手段

一つの`exit-criteria.yml`に`version: 1`と一件以上の`criteria` mappingを置く。各criterion IDは一度だけ現れ、同じmappingに`text`、非emptyの`argv`配列、任意の`cwd`、任意の`timeout_seconds`を持つ。`cwd`の既定値は`.`とする。`cwd`はrepository rootを基準に字句的に正規化し、`..`によるroot外への脱出は拒否するが、root内判定ではsymlinkの実体を解決せず、sandboxまたはfilesystem isolationの境界にはしない。`timeout_seconds`の既定値は`300`とし、指定値は`0`より大きく`2147483.647`以下とする。checkerは作業完了までforegroundに残り、background processを残さない。Exit Criteriaがtimeoutまたはinterruptで終了させるのは直接起動したprocessだけとし、platform固有のprocess tree管理は持たず、子孫processを管理しない。`issue`、`checks`、`evidence_kind`、profile reference、`include`、`extends`はこの設定形式に持たせない。

## 変更履歴

- process treeの実測を受け、`timeout_seconds`のplatform別終了境界を明記した。
- coreのplatform分岐を廃止し、直接foreground processだけを管理するcontractへ変更した。
- Node timerの上限を超えた値が即時timeoutへ反転する実測を受け、`timeout_seconds`の上限を固定した。
- 初期対応OSをmacOSとLinuxへ限定し、process管理の記述を対応OSのcontractとして明確化した。
