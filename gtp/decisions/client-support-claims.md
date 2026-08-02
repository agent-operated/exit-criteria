## 未決定事項

Exit Criteria Skillが、どのclient surfaceで動作すると公式に表明するか。

## 採用した手段

target familyはCodexとClaude Codeとし、最初に検証するcandidate surfaceまたは検証順序は
固定しない。各client surfaceは任意の順で独立に検証でき、一つのsurfaceの結果は別surfaceの検証を
妨げず、そのsupportも成立させない。
support claimは実clientでのend-to-end testが通過した正確な組合せに限り、Skill release、surface、
client version、OS、Node.js version、およびmanualなSkill配置方式を明記する。同じsurfaceの別version、
別OS、別Node.js version、または別配置方式へ拡張しない。具体的なversionはこのDecision Recordへ固定しない。
manual検証では、release assetのSkill directoryを、repository間で共有されるclient-wide scopeへ配置する。
各clientが公式資料で定めるscope名と配置先は`README.md`の対応表が所有する。この表はmanual validationの
配置参照であり、表への掲載だけではsupport claimを成立させない。projectまたはrepository-localなscopeは
support対象にしない。
manual検証に共通するrelease assetの取得、配置先、version確認、Skill発見、clientが提供する
explicit invocation、削除、およびsystem requirementはrepository rootの`README.md`へ記載する。
support claimを追加する場合、そのclient surface固有の手順と正確な検証組合せも`README.md`へ追記する。
system requirementは`SKILL.md`の`compatibility`にもmacOS、Linux、Node.js 20以上と記載するが、
これらの記載だけで各client surfaceを対応済みとは扱わない。release noteは`README.md`を参照する。

client別end-to-end testでは、文書化した配置先からのSkill発見とclientが提供するexplicit invocationを
確認する。implementation planningまたはtarget mutation前とcompletion claim前の代表的なimplicit invocation、
および非invocationも確認する。さらに、post-install networkと
`npm install`なしでbundled runnerが実core reportを返すことを確認する。implicit invocationはclientと
modelの判断を含む。代表例の観測からすべての該当依頼での確実な発火をclaimしない。

end-to-end testが通過していないclient surfaceと検証組合せは`unverified`とする。support claimは
`skill-bundle-packaging.md`で選んだstandalone release assetのmanual配置に限定し、plugin install対応とは
表明しない。`agents/openai.yaml`はOpenAI client向けのoptional metadataとして扱い、portableなSkill
contractまたはsupport evidenceの正本にしない。

Claude Codeでcompletion claimの前にimplicit invocationが観測されない場合、利用者は固定した
lifecycle時点で再確認するfallbackとしてclient側へhookを設定する。このfallbackはExit Criteria core、
Skillのinstall、通常利用、またはsupport claimの要件にしない。hookの利用だけでSkill activationまたは
complianceを保証しない。completion時のhookはimplementation planningまたはtarget mutation前の第一段階を
代替しない。hook設定とhook用stateはrelease assetへ同梱しない。

最終response本文をartifactとして検査する依頼は、検査結果を利用者が取得できる別のmessage、file、
またはmetadataへ分離できる場合だけ対応する。分離できない場合、そのsurface全体ではなく、該当する
requestとsurfaceの組合せを未対応とする。検査対象は送信前のdraftであり、最終送信bytesとの同一性は
保証しない。

## 変更履歴

- v1.0.2で、client別検証対象へ二段階の代表的なimplicit invocationを追加し、completion時のhookでは
  第一段階を代替できない境界を追加した。
- [PR #15](https://github.com/agent-operated/exit-criteria/pull/15)で、target familyをCodexだけから
  CodexとClaude Codeへ広げ、この二つのclient-wide scopeの対応表を`README.md`へ置く手段に変更した。
  対応表への掲載だけではsupport claimを成立させず、Claude Codeでimplicit invocationが観測されない
  場合のhookをclient側fallbackに限定した。
- [PR #12](https://github.com/agent-operated/exit-criteria/pull/12)で、manual配置をCodexの`USER` scopeへ
  限定し、`REPO` scopeをsupport対象外とした。
- [PR #14](https://github.com/agent-operated/exit-criteria/pull/14)で、Codex CLIを最初のcandidateに
  固定する手段から、各Codex surfaceを任意の順で独立に検証する手段へ変更。
