## 未決定事項

Exit Criteria coreと、このrepositoryが公式に配布するcaller実装が、criteriaの準備から評価後の受理までのどの責任を担うか。

## 採用した手段

Exit Criteria coreは、与えられたcriteriaのcommandを実行する。既存contractに従うoutcome、CLI exit code、
reportを返す。有効なmanifestを扱ったreportには`config_digest`を含め、checkerの診断はstderrへ流す。
coreはcriteriaを作成または選択せず、結果を修復しない。

このrepositoryが公式に配布するExit Criteria Skillは、交換・削除可能な標準caller実装とする。Skillは
target mutation前のplanning段階で、依頼からmaterial claimを列挙し、各claimを具体的なcriterionまたは
coverage gapへ対応付ける。manifestを準備し、`show-config`が返す実効定義と`config_digest`を同じtask内の
pre-work baselineとして保持する。completion提示前のverification段階では、baselineと一致するmanifestで
coreを呼び出す。baselineが存在しない既存targetもretrospective verificationとして検査できるが、criteriaが
実装前に固定されていたとは扱わない。

criteriaの承認、taskを越える固定と保存、期待するdigestの比較を強制するpolicy、実行強制、修復、reportを
信頼するための運用、およびreportと受理対象artifactの結び付けは、利用者または上位callerが担う。

coreはGit、GitHub、Issue、pull request、CI、MCP、言語モデル、network serviceをruntime要件にしない。公式Skillの追加によってcoreの責任とruntime要件を広げない。

## 変更履歴

- v1.0.2で、公式Skillの責務へtarget mutation前のbaseline準備と、同じbaselineを使うcompletion前の
  verificationを追加した。taskを越える保存と強制はcaller責務のままとした。
- [Issue #11](https://github.com/agent-operated/exit-criteria/issues/11)を受け、
  [PR #12](https://github.com/agent-operated/exit-criteria/pull/12)で、caller責務をcore外に置く判断を
  維持したまま、このrepositoryが提供する交換・削除可能な標準caller実装としてSkillの責任範囲を追加。
