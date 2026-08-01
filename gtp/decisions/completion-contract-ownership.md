## 未決定事項

Exit Criteriaが評価する終了条件の正本を、外部protocol（GTP 1.xのContract）が所有するか、Exit Criteria自身が所有するか。

## 採用した手段

Exit Criteria coreはcriteria manifestとreportの形式だけを所有し、個別projectまたはdomainの終了条件を所有しない。実行する具体的なcriteriaは呼び出し側がflatなlocal manifestとして与える。再利用可能なcriteriaとcheckerはcore外のcriteria profile repositoryが所有する。GTP、GitHub Issue、profile repository、外部adapterはruntime要件にしない。

## 変更履歴

- [Issue #2](https://github.com/agent-operated/exit-criteria/issues/2)では、GTP Contractが完了条件を所有し、Exit Criteria独自のCompletion Contractを持たないとしていた。汎用coreが特定protocolとGitHub Issueを必須とする状態になったこと、およびGTP 2.0が完了状態とEvidence集約を扱わなくなったことから、Exit Criteria自身が所有する形へ変更。
- [PR #8](https://github.com/agent-operated/exit-criteria/pull/8)で、result-only coreとcriteria profileの
  分離に伴い、個別criteriaの所有をExit Criteria自身から呼び出し側およびprofile repositoryへ
  移し、coreの所有をmanifestとreportのcontractへ限定した。
