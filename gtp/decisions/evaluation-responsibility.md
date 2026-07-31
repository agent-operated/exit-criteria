## 未決定事項

Exit Criteriaが、完了条件の承認、固定、保存、実行強制まで担うか、与えられた条件の評価と報告だけを担うか。

## 採用した手段

Exit Criteriaは、与えられたcriteriaのcommandを実行し、AIの「完成しました」を実行された検査結果へ置き換える。返すのはoutcome、exit code、設定digestを含むreportだけとし、checkerの診断はstderrへ流す。criteriaの作成、選択、承認、固定、保存、比較、実行強制、修復、およびreportを信頼するための運用は呼び出し側またはcriteria profileが担う。Exit CriteriaはGit、GitHub、Issue、pull request、CI、MCP、言語モデル、network serviceをruntime要件にしない。
