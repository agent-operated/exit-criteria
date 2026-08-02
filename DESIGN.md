# Exit Criteria Design

## 製品の役割

Exit Criteriaは、AIの「完成しました」を、実行された検査結果へ置き換える小さな
acceptance gateである。

coreは、一つのlocal manifestを読み、宣言されたforeground commandを実行し、
`PASS`、`FAIL`、`UNAVAILABLE`をversion付きJSONまたは人間向けtextで返す。有効なmanifestの
reportには`config_digest`も入れる。
coreは、何を完成条件にするかを決めない。

```text
user request + target artifact ──> optional Exit Criteria Skill ──┐
                                         └──> coverage gaps       │
selected criteria profile / external caller ──────────────────────┤
                                                                  v
                                                        local manifest
                                                                  │
                                                                  v
                                                        Exit Criteria core
                                                                  │
                                                                  v
                                                       result-only report
```

## Supported platforms

現在の対応contractはmacOSとLinuxに限定する。Windowsは未対応であり、Windowsでの挙動は
contract対象外とする。coreはruntimeでOSを拒否せず、Windows専用分岐も持たない。

## Ownership

`DESIGN.md`は現在のarchitectureを所有する。`gtp/decisions/`のDecision Recordは、後から
変える影響が大きい採用手段とその変更履歴を所有する。両者の不一致は、片方を暗黙に優先して
解釈せず、設計不整合として修正する。

### Core

coreが所有するのは、次のcontractだけである。

- flatなcriteria manifestのschema、parse、normalize
- manifestに明記された直接foreground processの実行
- criterion outcomeの集約
- versioned JSON report、人間向けtext report、exit code
- 実効manifestを識別する`config_digest`

このrepository自身の`exit-criteria.yml`は、このprojectが自分を検査するためのlocal
manifestであり、利用者向けの組み込みcriteria profileではない。

### Criteria profile repositories

特定種類の成果物に再利用できるcriteria、checker、説明、fixtureは、coreとは別の
repositoryが所有する。この配布単位を**criteria profile**と呼ぶ。

criteria profileは、少なくとも次を持つ。

- `exit-criteria.yml`または、それをprojectへmaterializeする明確な手順
- checker assets
- 対象、非対象、必要dependencyを説明するREADME
- 既知のgood artifactが`PASS`するfixture
- 既知のbad artifactが`FAIL`するfixture
- profile自身のtestとlicense

`profile`は、複数のcontrolと実行資産をまとめたversion付きの再利用単位として使われる
[Chef InSpec Profile](https://docs.chef.io/inspec/6.8/profiles/)の既存語に合わせる。
engineとcommunity contentを別repositoryに置く構造は、
[Nuclei Templates](https://github.com/projectdiscovery/nuclei-templates)と同じ境界を使う。

community repositoryはprofileを共同で作成・review・議論できる場所を提供するが、唯一の
配布元にも、profileの正しさを保証するauthorityにもならない。第三者は独立したprofile
repositoryを作成できる。

### Caller

呼び出し側は次を所有する。

- profileの発見、取得、review、version固定、projectへの配置
- project固有criteriaの作成、選択、承認、保存、変更管理
- checker dependencyと実行環境
- 期待するdigestとの比較
- reportの保存、真正性、実行強制
- reportとartifact bytes、revision、taskの結び付け
- `FAIL`または`UNAVAILABLE`後の修復と再実行

### Exit Criteria Skill

このcaller責務は定義済みだが、公式に配布できる標準caller実装はまだなかった。このrepositoryは、
その標準実装としてExit Criteria Skillを採用する。Skillは交換・削除可能であり、Skillからcoreを
一方向に呼び出す。coreはSkillへ依存せず、local manifestによる直接利用を維持する。

Skillは、request、明示された制約、non-goalからmaterial claimを列挙し、列挙した各claimを
具体的なcriterionと`argv`、または実行可能な検査へできない理由を示すcoverage gapのどちらかへ
対応付ける。claim列挙の網羅性は保証しない。coverage gapはcaller側の検査結果であり、coreの
outcomeまたはreport fieldではない。core reportとは別にSkillが返すcaller側outputのcarrierと形式は
固定しないが、同じcarrierへ出す動的な値によってentryの境界を偽装できないようにする。暗黙起動の
通常のchatでは、利用者の言語でmaterial claimごとの結果と未確認点を平易に説明する。明示起動または
完全な記録の要求では、core reportとcaller側outputを分離して返す。

criterionにはprojectに既存のtest、validator、linter、build command、domain toolを優先する。
task固有checkerが必要ならinspection support fileとしてtarget artifact外へ作成できるが、一回のtaskで
必要になったcheckerをcore、Skill、またはcriteria profileの常設機能へ自動昇格しない。

Skillがtask固有manifestを組み立てる際、具体的なcriterionと`argv`を一件も構成できない場合だけ、
manifestを作らずcoreを起動しない。この場合はcoverage gapだけを返し、存在しないcore reportや
`config_digest`を作らない。manifestへ入れてcoreへ渡したcriterionについて、coreが返す
`spawn_failed`、`timeout`、`terminated_by_signal`は`UNAVAILABLE`のまま返し、coverage gapへ
置き換えない。coreを起動していないcallerまたはpackageのerrorからcore outcomeやreportを作らない。

core reportを取得した場合、Skillはreportを改変せず、存在する`config_digest`とともに保持する。これとは
別にrunner statusとdiagnostics、coverage gap、reportの`results`に列挙され、同じreportの
`config_digest`が識別するcriteriaの実効定義を保持する。暗黙起動では、これらを通常のchatへ既定表示せず、
依頼内容との関係を利用者の言語で説明する。明示起動または完全な記録の要求では、分離した情報を利用者へ
返す。これらの返却情報だけで、削除済みcheckerを再構成できるとはclaimしない。

coreのoutcome、CLI exit code、report、`config_digest`を改変しない。coverage gapが一件でもあれば、
実行済みcriteriaがすべて`PASS`でも、依頼全体を検証済みとは表現しない。coreの`PASS`を
target artifact全体の正しさへ拡張しない。

Skillはtarget artifactを生成、編集、または修復しない。response draftを検査対象にできるのは、検査結果を
利用者が取得できる別のcarrierで返せるrequestとclient surfaceの組合せだけとする。別carrierが
なければその組合せを未対応とする。draftの検査結果は、最終送信bytesとの同一性を保証しない。
criteriaの承認、固定、保存、実行強制、修復、およびreportを信頼するための運用はSkillが担わず、
引き続き利用者側のcaller責務とする。

## Checker contract

一つのcriterionは一つの直接processを起動する。checkerは、必要な子processを含む作業が
終わるまでforegroundに残り、background processまたはdaemonを残してはならない。

- exit code `0`: criterionを満たした
- その他のnumeric exit code: criterionを満たさなかった
- 起動不能、timeout、signal終了: `UNAVAILABLE`
- 診断: stderr

直接processのnumeric exit codeだけでは完走としない。stdoutとstderrが閉じた時点で完走とする。
直接processがexit code `0`で終了しても、背景processがpipeを保持し続けた場合は
`timeout_seconds`で`UNAVAILABLE`になる。

coreがtimeoutまたはinterruptで終了させるのは、直接起動したprocessだけである。
process tree、container、job object、daemon lifecycleは管理しない。checkerがcontractに
違反してpipeを保持しても、coreはtimeoutでpipeを閉じて`UNAVAILABLE`を返すが、子孫processの
終了は保証しない。この境界は対応OSで共通であり、platform固有のprocess tree管理は持たない。

`cwd`はbackslashもseparatorとして扱い、repository rootを基準に字句的に正規化する。
absolute path、`C:checks`や`a:b`のような先頭のASCII英字と`:`、`..`でroot外へ出るpathを
全対応OSで拒否する。
root内判定ではsymlinkの実体を解決しないため、root内のsymlinkがroot外を指す場合、checkerは
root外で実行され得る。この検査はsandboxまたはfilesystem isolationの境界ではない。

各criterionは独立させ、実行順を通信、依存関係、優先度に使わせない。coreはcriterionの
実行順をcontractにせず、schedule方式を変更できる。

## Absolute core boundary

AIによる加算バイアスを、将来の便利さ、一般性、対称性、拡張余地を理由にcoreへ持ち込まない。
coreへ追加できるのは、manifestのparse、直接commandの実行、outcome集約、report生成の
正しさ、portable性、診断、security、または既存contractの互換性に直接必要な変更だけである。

次はcoreの非目標ではなく、**越えてはならない境界**である。

- domain固有criteria、checker、profile、推奨profile selectionを同梱しない
- profileの検索、registry、download、install、update、cache、署名、trust判定を行わない
- manifestのremote reference、`include`、`extends`、merge、dependency解決を行わない
- Git、GitHub、Issue、pull request、CI、MCP、言語モデルをruntime要件にしない
- HTTP server、remote execution、network service、hidden sessionを持たない
- criteriaやdigestの承認、固定、保存、比較、強制を行わない
- workflow、task、retry、修復、成果物生成を管理しない
- artifactのupload、保存、内容hash、revision binding、attestationを管理しない
- shell command文字列を受け付けず、sandbox、container、process tree supervisorを内蔵しない
- profile SDK、plugin loader、hook system、汎用policy engineへ拡張しない

caller、criteria profile、任意adapterで実現できる機能はcoreへ入れない。MCPなどのadapterが
必要なら、coreを呼ぶ別packageまたは別repositoryとして作る。

この境界を越える変更は、実装やdependency追加より先に、人間が本fileと該当Decision Recordを
明示的に変更した場合だけ開始できる。AIの提案、Issue、将来の可能性、既存codeの都合だけでは
境界変更の根拠にならない。

## Boundary checks

coreのruntime dependencyはmanifest parserだけに固定する。sourceからnetwork client、server、
MCP SDK、model provider SDKを参照しないことをarchitecture testで検査する。このtestは設計の
代わりではない。正当な境界変更でも、先に人間が設計を変更するまでtestを弱めない。

## Report claims

`PASS`が示すのは、reportに列挙されたcriteriaが、その実行でexit code `0`を返したことだけである。

`FAIL`が示すのは、直接起動したcheckerがnumeric nonzero exit codeを返したことだけである。
criterion自体の不適合と、checker内部のdependencyまたは実行環境の不備は区別しない。

`config_digest`が識別するのは実効manifestである。repository root、config path、`PATH`を含む
環境変数、解決後の実行file、checker scriptのbytes、Exit Criteriaのrevision、profile release、
artifact、commit、reportの真正性は識別しない。criteriaが弱い場合、またはcheckerが誤っている
場合、`PASS`の保証も弱い。

## Direct core CLI source surface

```console
node /absolute/path/to/exit-criteria/dist/src/cli.js check [--config PATH] [--repo-root PATH] [--json]
node /absolute/path/to/exit-criteria/dist/src/cli.js [-h|--help]
```

direct core CLIはreview済みsource checkoutのbuild outputから実行する開発用interfaceであり、
npm package、global command、またはrelease versionを公開しない。`-h|--help`は`check`と一緒にも
指定できる。`-v|--version`、bareな`help`、bareな`version`は受け付けない。

relativeな`--config`は`--repo-root`を基準に解決する。absolute pathと`..` segmentを許可し、
解決後のconfig pathはroot外になり得る。configはcaller所有の信頼済みmanifestであり、criterion
`cwd`と違ってroot内へ制限せず、backslashをseparatorへ変換しない。この規則はsandbox境界ではない。

public outcomeは`PASS`、`FAIL`、`UNAVAILABLE`、criteria reportのexit codeは`0`、`1`、`2`である。
新しいcommand、outcome、report field、manifest fieldはpublic contract変更として扱う。

Exit Criteria Skillのsourceとrelease buildは、このdirect core CLI source surfaceには含めない。
standalone Skill runnerはSkill release versionと`show-config`を持つ。release assetを配布しても、
それだけではclient supportを意味しない。
対応するSkill release、client surface、client version、OS、Node.js version、manual配置方法の
support claimは、後続の実client e2eが通過した組合せに限って追加する。
