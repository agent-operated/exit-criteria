# Contributing

The Exit Criteria core CLI remains source-only. The npm package is private and
unpublished; the standalone Skill is distributed separately through GitHub
Release assets. Development requires Node.js 20 or later.

Before changing behavior, read [DESIGN.md](DESIGN.md), [GTP.md](GTP.md), and
the existing [Decision Records](gtp/decisions/). Preserve the absolute core
boundary in `DESIGN.md`. In particular, do not add criteria profiles, profile
discovery or installation, installers, adapters (including GTP or MCP
adapters), or generic artifact attestation to core.

Fork the repository or create a branch in a writable clone, make the smallest
change that addresses the problem, and run:

```console
npm ci
npm run typecheck
npm test
node dist/src/cli.js check --json
```

Open a pull request that states:

- the purpose of the change;
- any user-visible behavior that changes;
- the validation that was run; and
- the related Decision Records, or that none apply.

Create a Decision Record only when the conditions in `GTP.md` are met. Do not
use one for routine implementation details.

Report suspected security vulnerabilities as described in
[SECURITY.md](SECURITY.md). Use [GitHub Issues](https://github.com/agent-operated/exit-criteria/issues)
for ordinary bugs and feature discussions.

---

# コントリビューション

Exit Criteria core CLIは引き続きsourceから利用します。npm packageはprivateで未公開であり、
standalone SkillはGitHub Release assetとして別に配布します。開発にはNode.js 20以上が必要です。

挙動を変更する前に、[DESIGN.md](DESIGN.md)、[GTP.md](GTP.md)、既存の
[Decision Record](gtp/decisions/)を読んでください。`DESIGN.md`のabsolute core boundaryを
守ってください。特に、criteria profile、profileの検索やinstall、installer、GTPやMCPを
含むadapter、汎用artifact attestationをcoreへ追加しないでください。

repositoryをforkするか、書き込み可能なcloneでbranchを作り、問題を解く最小の変更を行います。
次を実行してください。

```console
npm ci
npm run typecheck
npm test
node dist/src/cli.js check --json
```

pull requestには次を記載してください。

- 変更の目的
- 利用者から見える挙動の変更
- 実行した検証
- 関連するDecision Record、または該当なし

Decision Recordは`GTP.md`の条件を満たす場合だけ作成します。通常の実装詳細には作成しません。

security vulnerabilityの疑いは[SECURITY.md](SECURITY.md)に従って報告してください。
通常のbugや機能の議論には[GitHub Issues](https://github.com/agent-operated/exit-criteria/issues)を
使ってください。
