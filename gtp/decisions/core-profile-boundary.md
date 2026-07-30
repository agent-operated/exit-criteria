## 未決定事項

Exit Criteria coreと、再利用可能なcriteriaおよびcheckerの所有と配布を、同じrepositoryで扱うか分離するか。

## 採用した手段

Exit Criteria coreは、flatなlocal manifestのparse、直接foreground commandの実行、outcome集約、reportとdigestの返却だけを所有する。再利用可能なcriteria、checker、fixture、domain固有の議論は、coreとは別のcriteria profile repositoryが所有する。coreはprofileの検索、取得、install、update、合成、dependency解決、registry、trust判定を行わない。呼び出し側がprofileを選択、確認、version固定し、実行可能なlocal manifestとして配置する。
