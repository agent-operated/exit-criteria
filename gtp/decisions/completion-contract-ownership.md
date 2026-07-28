## 未決定事項

Exit Criteriaが評価する終了条件の正本を、外部protocol（GTP 1.xのContract）が所有するか、Exit Criteria自身が所有するか。

## 採用した手段

Exit Criteria自身が終了条件の正本を所有する。coreは正規化されたcriteria表現だけを扱い、GTPおよびGitHub Issueをruntime要件にしない。外部の入力元は、coreの表現へ変換するadapterとして追加できる位置にとどめる。

## 変更履歴

- [Issue #2](https://github.com/agent-operated/exit-criteria/issues/2)では、GTP Contractが完了条件を所有し、Exit Criteria独自のCompletion Contractを持たないとしていた。汎用coreが特定protocolとGitHub Issueを必須とする状態になったこと、およびGTP 2.0が完了状態とEvidence集約を扱わなくなったことから、Exit Criteria自身が所有する形へ変更。
