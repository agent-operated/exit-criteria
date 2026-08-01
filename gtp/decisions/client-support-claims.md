## 未決定事項

Exit Criteria Skillが、どのclient surfaceで動作すると公式に表明するか。

## 採用した手段

target familyはCodexとし、最初に検証するcandidate surfaceまたは検証順序は固定しない。各Codex surfaceは
任意の順で独立に検証でき、一つのsurfaceの結果は別surfaceの検証を妨げず、そのsupportも成立させない。
support claimは実clientでのend-to-end testが通過した正確な組合せに限り、Skill release、surface、
client version、OS、Node.js version、およびmanualなSkill配置方式を明記する。同じsurfaceの別version、
別OS、別Node.js version、または別配置方式へ拡張しない。具体的なversionはこのDecision Recordへ固定しない。
Codex surfaceでは、release assetのSkill directoryを、repository間で共有される
[公式の`USER` scope](https://learn.chatgpt.com/docs/build-skills)である`$HOME/.agents/skills`配下へ
manual配置する。`REPO` scopeの`.agents/skills`への配置はsupport対象にしない。
manual検証に共通するrelease assetの取得、配置先、version確認、Skill発見、clientが提供する
explicit invocation、削除、およびsystem requirementはrepository rootの`README.md`へ記載する。
support claimを追加する場合、そのclient surface固有の手順と正確な検証組合せも`README.md`へ追記する。
system requirementは`SKILL.md`の`compatibility`にもmacOS、Linux、Node.js 20以上と記載するが、
これらの記載だけでCodexの各surfaceを対応済みとは扱わない。release noteは`README.md`を参照する。

client別end-to-end testでは、文書化した配置先からのSkill発見とclientが提供するexplicit invocationを
確認する。代表的なimplicit invocationと非invocationも確認する。さらに、post-install networkと
`npm install`なしでbundled runnerが実core reportを返すことを確認する。implicit invocationはclientと
modelの判断を含む。代表例の観測からすべての該当依頼での確実な発火をclaimしない。

end-to-end testが通過していないCodex surfaceと検証組合せは`unverified`とする。support claimは
`skill-bundle-packaging.md`で選んだstandalone release assetのmanual配置に限定し、plugin install対応とは
表明しない。`agents/openai.yaml`はOpenAI client向けのoptional metadataとして扱い、portableなSkill
contractまたはsupport evidenceの正本にしない。

最終response本文をartifactとして検査する依頼は、検査結果を利用者が取得できる別のmessage、file、
またはmetadataへ分離できる場合だけ対応する。分離できない場合、そのsurface全体ではなく、該当する
requestとsurfaceの組合せを未対応とする。検査対象は送信前のdraftであり、最終送信bytesとの同一性は
保証しない。

## 変更履歴

- [PR #12](https://github.com/agent-operated/exit-criteria/pull/12)で、manual配置をCodexの`USER` scopeへ
  限定し、`REPO` scopeをsupport対象外とした。
- [PR #14](https://github.com/agent-operated/exit-criteria/pull/14)で、Codex CLIを最初のcandidateに
  固定する手段から、各Codex surfaceを任意の順で独立に検証する手段へ変更。
