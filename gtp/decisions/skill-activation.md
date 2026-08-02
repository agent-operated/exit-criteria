## 未決定事項

公式Skillの完全なinstructionsを、どの依頼と時点でagent contextへ読み込むか。

## 採用した手段

この判断で`activation`とは、対応clientが公式Skillの完全なinstructionsをagent contextへ読み込むことをいう。
acceptance workflowの開始、runner実行、成果物変更、権限付与、または完了判定を意味しない。

implicit invocationは、利用者が特定可能なartifactまたはstateのacceptance、completion、conformance、
verificationを依頼した場合に行う。Agentが作成または変更した具体的なartifactを、完成済みもしくは
利用可能として返す直前にも行う。この提示はstatus報告だけの依頼には含めない。説明、助言、設計相談、
completionまたはreadyのclaimを伴わないstatus報告だけの依頼では自動起動しない。
利用者がSkill名またはclientの選択機能でexplicit invocationを行った場合は、clientが対応していれば
読み込む。ただし、検査対象がない依頼ではacceptance workflowを開始しない。

対象のtest、CI、manual検証はevidenceである。completionまたはreadyのclaimに含まれるmaterial claimを
criterionまたはcoverage gapへ対応付ける検査の代替にはしない。これらのevidenceが存在しても、
completionまたはreadyのclaimをstatus報告だけの依頼として扱わない。

`target artifact`は、利用者が作成、変更、または適合確認を求めた成果物またはstateとする。検査時点の状態を
特定できるものに限る。response本文は、その本文自体がdraft、rewrite、translation、transformation、
formatted output、またはsubmissionとして依頼された場合だけtarget artifactに含める。
`material claim`は、それが偽なら利用者の受入判断が変わるclaimとする。

適切なcheckerが既知かどうかはactivation条件にしない。implicit invocationはclientとmodelの判断を含む。
そのため、すべての該当依頼での確実な発火はclaimしない。

## 変更履歴

- [PR #15](https://github.com/agent-operated/exit-criteria/pull/15)で、completionまたはreadyのclaimを伴う
  提示はstatus報告だけの依頼に含めず、対象のtest、CI、manual検証をSkillによるclaim検査の代替に
  しない境界を追加した。
