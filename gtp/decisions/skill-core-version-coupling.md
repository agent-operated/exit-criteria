## 未決定事項

同じreleaseとして配布するExit Criteria Skillとbundled runnerのversionを、どう対応付けるか。

## 採用した手段

release時のGit tag文字列を加工せず、`SKILL.md`の`metadata.version`とbundled runnerへ埋め込むversionへ
投影する。runnerはcoreを起動する前に同じSkill directoryの`SKILL.md`を読む。両者の文字列が完全一致する
ことを検査する。不一致または`metadata.version`を読み取れない場合はpackage errorをstderrへ出して
nonzeroで終了する。core outcome、report、`config_digest`は作らない。

この一致が示すのは、Skillとrunnerが同じdeclared release identityを名乗っていることだけである。
両者が異なるidentityを宣言する組合せは拒否できるが、同じbuildから作られたこと、build provenance、
integrity、または改変されていないことは証明しない。hash、signature、attestationは導入しない。

release e2eでは、同じdeclared release identityのpairが実coreを起動できることと、片方だけ異なるidentityを
宣言するpairがcore起動前に拒否されることを検査する。

この照合とsupport claimは生成済みrelease assetのSkillに限定する。source checkout内の未bundle Skillは
development用途とし、既存のdirect core CLIはSkill metadataを参照せず現在のcontractを維持する。
