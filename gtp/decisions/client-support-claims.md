## 未決定事項

Exit Criteria Skillが、どのclient surfaceで動作すると公式に表明するか。

## 採用した手段

target familyはCodexとし、最初に検証するcandidateはCodex CLIとする。support claimは実clientでの
end-to-end testが通過した組合せに限り、Skill release、surface、client version、OS、Node.js version、
およびmanualなSkill配置方式を明記する。具体的なversionはこのDecision Recordへ固定しない。
`SKILL.md`の`compatibility`にはmacOS、Linux、Node.js 20以上の要件を記載するが、それだけで
Codexの各surfaceを対応済みとは扱わない。

client別end-to-end testでは、文書化した配置先からのSkill発見とclientが提供するexplicit invocationを
確認する。代表的なimplicit invocationと非invocationも確認する。さらに、post-install networkと
`npm install`なしでbundled runnerが実core reportを返すことを確認する。implicit invocationはclientと
modelの判断を含む。代表例の観測からすべての該当依頼での確実な発火をclaimしない。

Codex IDE extensionとCodex in the ChatGPT desktop appは、surfaceごとのend-to-end testが通過するまで
`unverified`とする。support claimは`skill-bundle-packaging.md`で選んだstandalone release assetの
manual配置に限定し、plugin install対応とは表明しない。`agents/openai.yaml`はOpenAI client向けの
optional metadataとして扱い、portableなSkill contractまたはsupport evidenceの正本にしない。

最終response本文をartifactとして検査する依頼は、検査結果を利用者が取得できる別のmessage、file、
またはmetadataへ分離できる場合だけ対応する。分離できない場合、そのsurface全体ではなく、該当する
requestとsurfaceの組合せを未対応とする。検査対象は送信前のdraftであり、最終送信bytesとの同一性は
保証しない。
