## 未決定事項

公式Skillと、その実行に必要なcodeおよびdependencyをどの単位で配布するか。

## 採用した手段

公式Skillは、[Agent Skills specification](https://agentskills.io/specification)に従う一つのstandalone
Skill directoryをrelease assetとして配布する。directoryには`SKILL.md`と単一のbundled JavaScript
runnerを置く。runnerにはSkill package用entrypoint、core、YAML parserを含める。OpenAI client向けの
`agents/openai.yaml`と必要なthird-party license noticeも同じdirectoryへ置く。install、update、removeは
一つのSkill directoryだけで完結させる。plugin installへの対応はclaimしない。

正準sourceはrepository内のcore source、Skill source、build configuration、lockfileとする。bundleは
tagged sourceからrelease時に生成する。手編集せず、source treeへcommitしない。生成済みbundleを含む
release assetだけをSkillのinstall対象とし、GitHubのSource code archiveをSkill配布物とは呼ばない。

Skill自身のruntime dependencyはNode.js 20以上だけとする。install後の初回起動でrepository clone、
`npm install`、network accessを要求しない。個別criterionが使用するtoolとcheckerはSkill自身のruntime
dependencyに含めない。release前に生成済みSkill directoryだけをclean temporary directoryへ取り出し、
実際のcoreを端から端まで実行する。

bundler、build flag、bundle size、runnerのfile名、notice fileのfile名はcontractとして固定しない。
