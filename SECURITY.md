# Security Policy

## Supported Versions

There is no supported release yet. `main` is a development branch, not a
versioned release, and may change without notice. Source users should pin a
reviewed full commit rather than a moving branch. No response or remediation
time is promised.

## Reporting a Vulnerability

Use [GitHub private vulnerability reporting](https://github.com/agent-operated/exit-criteria/security/advisories/new)
for a suspected vulnerability. Do not file a public issue for it.

Include enough information to investigate safely:

- the affected commit or version;
- the platform and Node.js version;
- reproduction steps or a minimal reproducer;
- the observed and expected behavior; and
- the likely impact.

This route submits the report through GitHub's private channel. It does not
create an additional confidentiality or response-time guarantee from this
project.

## Security Boundary

The documented execution model is not a sandbox. Exit Criteria intentionally
runs arbitrary executables from a trusted manifest. `shell: false` prevents
shell-string interpretation but does not isolate those executables. The `cwd`
boundary is lexical and does not resolve symlinks, and the runner manages only
the directly started process rather than its descendant process tree. These
behaviors alone are not vulnerabilities.

A bypass of documented manifest validation or execution boundaries, a false
`PASS` or corrupted result, or a vulnerable dependency may be security
relevant. See the [README responsibility boundary](README.md#responsibility-boundary)
and the [design contract](DESIGN.md#checker-contract) before reporting.

---

# Security Policy（日本語）

## 対応version

現在、support対象のreleaseはありません。`main`はversion付きreleaseではなく開発branchであり、
予告なく変わる場合があります。source利用者はmoving branchではなく、review済みのfull commitへ
固定してください。応答時間や修正時間は約束しません。

## Vulnerabilityの報告

security vulnerabilityの疑いは、
[GitHub private vulnerability reporting](https://github.com/agent-operated/exit-criteria/security/advisories/new)
から報告してください。public Issueには投稿しないでください。

安全に調査できるよう、次の情報を含めてください。

- 影響を受けるcommitまたはversion
- platformとNode.js version
- 再現手順または最小の再現例
- 実際の挙動と期待する挙動
- 想定される影響

この経路はGitHubのprivate channelから報告を送ります。このprojectが追加の秘密保持や応答時間を
保証するものではありません。

## Securityの境界

文書化された実行modelはsandboxではありません。Exit Criteriaは、信頼されたmanifestから任意の
実行fileを起動します。`shell: false`はshell文字列の解釈を防ぎますが、実行fileを隔離しません。
`cwd`境界は字句的でsymlinkを解決せず、runnerは子孫process treeではなく直接起動したprocessだけを
管理します。これらの挙動だけではvulnerabilityに当たりません。

文書化されたmanifest validationや実行境界の回避、誤った`PASS`や結果の破損、脆弱なdependencyは、
security上の問題になり得ます。報告前に、[READMEの責任の境界](README.md#責任の境界)と
[設計contract](DESIGN.md#checker-contract)を確認してください。
