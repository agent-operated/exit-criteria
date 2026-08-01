## 未決定事項

利用者が完了条件とその検査commandを、どの設定構造でExit Criteriaへ渡すか。

## 採用した手段

一つのYAML manifestに`version: 1`と一件以上の`criteria` mappingを置く。manifest fileのbyte列は
正しいUTF-8に限定し、YAMLへparseする前に不正なUTF-8を拒否する。document内の全mapping keyは
stringに限定し、重複keyと未知fieldを拒否する。各criterion IDは一度だけ現れ、
空stringにしない。同じmappingに、空白だけでないstring `text`、非emptyのstring `argv`配列、
任意の`cwd`、任意の`timeout_seconds`を持つ。ID、`text`、`argv`、`cwd`のstringは不正な
Unicodeを拒否する。commandはargvを`shell: false`で直接実行し、shell command文字列を
受け付けない。

`cwd`の既定値は`.`とする。`cwd`はbackslashもseparatorとして扱い、repository rootを基準に
字句的に正規化する。absolute path、先頭のASCII英字と`:`、`..`によるroot外への脱出を
全platformで拒否する。root内判定ではsymlinkの実体を解決せず、sandboxまたはfilesystem
isolationの境界にはしない。
`timeout_seconds`の既定値は`300`とする。指定値は
有限numberで、`0`より大きく`2147483.647`以下に限定する。

CLIのrelativeな`--config` pathは`--repo-root`を基準に解決する。absolute pathと`..` segmentを
許可するため、解決後のconfig pathはroot外になり得る。manifestはcallerが所有する信頼済み
入力であり、config pathはcriterion `cwd`と違ってroot内へ制限しない。この挙動もsandbox境界に
せず、backslashをseparatorへ変換しない。

各criterionは独立させ、他criterionとの通信、依存関係、優先度に実行順を使わせない。coreは
実行順をpublic contractにせず、schedule方式を将来変更できる。machine reportのresult順は
criterion IDのUTF-16 code unit昇順とし、callerはその表示順に実行上の意味を持たせない。
このresult順の出力envelopeはCLI outcome contractが所有する。

checkerは作業完了までforegroundに残り、background processを残さない。Exit Criteriaがtimeout
またはinterruptで終了させるのは直接起動したprocessだけとする。platform固有のprocess tree
管理は持たず、子孫processを管理しない。`issue`、`checks`、`evidence_kind`、profile reference、
`include`、`extends`はこの設定形式に持たせない。

## 変更履歴

- [PR #10](https://github.com/agent-operated/exit-criteria/pull/10)で、YAMLからobjectへ変換する前に
  全mapping keyをstringへ限定し、numeric keyとquoted string keyの
  衝突によるcriterion上書きを拒否した。
- [PR #10](https://github.com/agent-operated/exit-criteria/pull/10)で、config pathとcriterion `cwd`で
  異なるroot境界、およびcriterionが実行順に依存しないcontractを
  明記した。
- [PR #10](https://github.com/agent-operated/exit-criteria/pull/10)で、criterion `cwd`だけが
  backslashをseparatorとして正規化するpath contractを明記した。
- [PR #10](https://github.com/agent-operated/exit-criteria/pull/10)で、process treeの実測を受け、
  `timeout_seconds`のplatform別終了境界を明記した。
- [PR #10](https://github.com/agent-operated/exit-criteria/pull/10)で、coreのplatform分岐を廃止し、
  直接foreground processだけを管理するcontractへ変更した。
- [PR #10](https://github.com/agent-operated/exit-criteria/pull/10)で、Node timerの上限を超えた値が
  即時timeoutへ反転する実測を受け、`timeout_seconds`の上限を固定した。
- [PR #10](https://github.com/agent-operated/exit-criteria/pull/10)で、初期対応OSをmacOSとLinuxへ限定し、
  process管理の記述を対応OSのcontractとして明確化した。
- [PR #10](https://github.com/agent-operated/exit-criteria/pull/10)で、不正なUTF-8をYAML parseと
  checker実行より前に拒否する境界を固定した。
- [PR #10](https://github.com/agent-operated/exit-criteria/pull/10)で、先頭のASCII英字と`:`を持つ
  `cwd`を全platformで拒否するportable contractへ固定した。
