## 未決定事項

Exit Criteria coreと、このrepositoryが公式に配布するcaller実装が、criteriaの準備から評価後の受理までのどの責任を担うか。

## 採用した手段

Exit Criteria coreは、与えられたcriteriaのcommandを実行する。既存contractに従うoutcome、CLI exit code、
reportを返す。有効なmanifestを扱ったreportには`config_digest`を含め、checkerの診断はstderrへ流す。
coreはcriteriaを作成または選択せず、結果を修復しない。

このrepositoryが公式に配布するExit Criteria Skillは、交換・削除可能な標準caller実装とする。Skillは依頼から
material claimを列挙し、各claimを具体的なcriterionまたはcoverage gapへ対応付ける。manifestの準備と
必要なcore呼び出しも担う。criteriaの承認、固定、保存、比較、実行強制、修復、reportを信頼するための運用、
およびreportと受理対象artifactの結び付けは、利用者または上位callerが担う。

coreはGit、GitHub、Issue、pull request、CI、MCP、言語モデル、network serviceをruntime要件にしない。公式Skillの追加によってcoreの責任とruntime要件を広げない。

## 変更履歴

- [Issue #11](https://github.com/agent-operated/exit-criteria/issues/11)を受け、caller責務をcore外に置く判断を
  維持したまま、このrepositoryが提供する交換・削除可能な標準caller実装としてSkillの責任範囲を追加。
