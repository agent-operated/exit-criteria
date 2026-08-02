## 未決定事項

Exit Criteria Skillが検査に使うmanifestとcheckerを、どこから取得し、どこへ配置し、いつ削除し、
利用者へ何を返すか。

## 採用した手段

Skillは、planning段階またはretrospective verificationで、利用者が明示したmanifest、callerが決めた
repository root直下の既存`exit-criteria.yml`、Skillが生成するmanifestの順に使用する。明示されたmanifestと
既存manifestは変更しない。planning段階では`check`を実行せず、`show-config`が返す実効定義と
`config_digest`をpre-work baselineとして保持する。明示起動または
完全な検査記録の要求では、実行前にpathを利用者へ示し、parseできる場合だけcriterionの`argv`も示す。
暗黙起動では同じ情報を検査用に取得するが、通常の完了報告へ繰り返さない。clientがtrustまたはpermissionの
境界としてcommandを表示することは妨げず、Exit Criteria独自の承認workflowを追加しない。emptyまたは
invalidでparseできないことをcore呼び出しを止める理由にせず、そのmanifestを変更せずに渡す。

filesystem上のtarget artifactを検査する場合、生成するmanifestとcheckerはtarget artifactおよび
repository rootの外側にあるfreshなtemporary directoryだけへ置く。この判断でcanonical pathとは、
symlinkを解決したreal pathをいう。作成前に既存temp parentと各保護対象のcanonical pathを比較する。
temp parentがいずれかの保護対象と同一または内側なら作成を拒否する。
temp parentが保護対象のancestorであることだけでは拒否しない。作成後にchildのcanonical pathを取得する。
childと各保護対象が同一またはいずれかが他方の内側なら拒否する。包含判定はpath segment単位で行う。
Skillがchild内に作るentryをsymlinkにしない。安全な配置を確立できなければsupport fileもcore reportも
作らず、Skill側の未実行理由を返す。
この検査は、安定したfilesystem上でsupport fileを対象へ混入させないためのものであり、sandbox、checkerの
read-only、または検査と利用の間に競合してpathが変わらないことを保証しない。

Skillがtask固有manifestを生成するとき、具体的なcriterionと`argv`を一件も構成できなければcoreを
起動せず、planning段階でcoverage gapを記録する。存在しないreportまたは`config_digest`は作らない。
同じtaskのverification段階では、保持したmanifestを再度`show-config`し、baselineまたは明示的な変更後baselineと
digestが一致しなければ`check`を起動しない。baselineがないretrospective verificationでは、明示されたmanifest
または対象の既存manifestがemptyまたはinvalidでもcoreへ渡し、coreのconfig-level `UNAVAILABLE`を
維持する。具体的なcriterionと`argv`を表現できる場合、実行fileまたはdependencyが利用できないという
preflight結果を理由にmanifestから省略せず、coverage gapへ変更しない。coreへ渡し、coreが返す
`spawn_failed`、`timeout`、`terminated_by_signal`を`UNAVAILABLE`のまま返す。

core reportを取得した場合、Skillは、そのreportを`config_digest`が存在すればそれを含めて改変せずに保持する。
これとは別にrunner statusとdiagnostics、coverage gap、reportに`config_digest`がある場合は、そのdigestが
識別する実効manifest上でreportの`results`に対応するcriterion定義を分離して保持する。これらの返却情報だけで、
削除済みcheckerを再構成できるとはclaimしない。

利用者がSkillを明示起動した場合、または完全な検査記録を要求した場合、Skillはこれらの情報を従来どおり
分離して返す。completeまたはreadyの提示前に暗黙起動した場合、通常のchat本文には完全な検査記録を
既定表示せず、material claim、core report、coverage gap、caller-side errorから利用者向け説明を作る。
この説明はcore reportを翻訳または改変したものではなく、core outcomeを置き換える新しいoutcomeまたは
受理の承認でもない。

暗黙起動の利用者向け説明は、Agentが従うinstructionの優先順位を守ったうえで、対象ごとに、利用者が
明示した言語、repositoryの適用可能な指示・仕様・templateが明示的に要求する言語、直接関係する既存の
会話または文章が一貫して使用する言語、現在の依頼で利用者自身が使用する言語の順に決める。言語を
指定しないsourceは飛ばす。最初に判断材料がある順位で候補が一つに決まらない場合、または最後まで
決まらない場合だけ、利用者へ一度確認し、解決するまでcompleteまたはreadyの提示を行わない。Skill自身の
instructions、同梱した例文、UI metadata、自動生成されたdefault prompt、machine outputは、利用者の言語を
決める根拠にしない。

選んだ言語で、依頼のどこを確認できたか、どこが依頼どおりでなかったか、どの検査を実行できなかったか、
何がまだ確認できていないか、利用者が確認または判断する必要があれば何を見ればよいかをmaterial claimごとに
平易に説明する。criterion ID、command名、検査件数、`argv`、temporary path、full core JSON、または
`PASS`、`FAIL`、`UNAVAILABLE`だけを説明の主語にしない。正式名称とmachine tokenは完全な検査記録では
原文を保つ。

clientが完全な検査記録を別message、file、metadataなどへ分離できる場合は、そのcarrierを使用できる。
分離できない場合、暗黙起動のchat表示を避けるためだけにfileまたは永続stateを作らず、その検査記録が
response後も取得できるとはclaimしない。Skillが返却carrierとしてfileを作る場合は、target artifactおよび
repository rootの外側へ置く。

Skillは、自身が作ったtemporary directoryだけを削除する。同じtaskでplanningとverificationを行う場合は
両段階の間だけ保持し、core結果の取得後、または扱える失敗と中止の終了時に削除する。planningだけでtaskが
終了する場合は、planning recordの返却または保存後に削除する。Skill process自体が強制終了された場合の
cleanupは保証しない。callerが明示した場合だけ、cleanup前にmanifestとcheckerをtarget artifactおよび
repository rootの外側にあるcaller-ownedの永続場所へ保存する。taskまたはsessionを越えてbaselineを使う場合は
この保存が必要である。既定ではworkflow終了後にcache、履歴、再実行用stateを残さない。

## 変更履歴

- [PR #20](https://github.com/agent-operated/exit-criteria/pull/20)で、planning段階のpre-work baselineから同じtaskのverificationまでsupport fileを保持し、
  verification前にdigest一致を要求する二段階lifecycleへ変更した。
- [Issue #17](https://github.com/agent-operated/exit-criteria/issues/17)を受け、
  [PR #18](https://github.com/agent-operated/exit-criteria/pull/18)で、暗黙起動では利用者の言語でmaterial claimごとの
  平易な説明を返し、明示起動または完全な記録の要求では分離した検査記録を返す手段へ変更。
- [PR #12](https://github.com/agent-operated/exit-criteria/pull/12)で、返却用fileとopt-inの永続保存先を
  target artifactおよびrepository rootの外側へ限定した。
