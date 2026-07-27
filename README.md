# Exit Criteria

> **The agent proposes completion. Exit criteria decide.**

> [!WARNING]
> **Nothing is implemented yet.** This repository currently holds a license, this
> README, and an intent. There is no package to install and no command to run.

## What this is

A coding agent can tell you it is finished. It cannot settle the question, because
the thing being judged and the thing judging would be the same system.

*Exit criteria* is the standard term for the conditions that must hold before an
activity can be declared complete. The idea is not new. What is missing is that
these conditions are usually prose — read once, agreed to vaguely, and never
mechanically checked.

This project makes them executable:

- the conditions are fixed before the work starts
- the agent may submit a candidate and repair it as often as needed
- **whether the conditions hold is decided by a machine, never by the agent**
- what was actually observed is recorded

## Why it matters

The loop this removes:

```text
"Done."  →  "It doesn't run."  →  "Done."  →  "Still doesn't run."  →  "Done."
```

Every turn in that loop costs a human's attention. Deciding the conditions once,
up front, costs it exactly once.

## What it will not do

- It will not judge whether your criteria are good ones
- It will not prove the software is correct
- It will not ask a language model to decide pass or fail

If the criteria are weak, passing them means very little. That limit is real and
will stay documented.

## Status

| | |
|---|---|
| Implementation | none |
| npm package | `exit-criteria` — unregistered, not published |
| License | MIT |

The intended first command is a zero-config check against a base branch. It does
not exist yet, and `npx exit-criteria` will not resolve to anything.

## License

[MIT](LICENSE)

---

# Exit Criteria（日本語）

> **agentは完了を提案する。決めるのは Exit Criteria。**

> [!WARNING]
> **まだ何も実装されていません。** 現在このrepositoryにあるのは、license、このREADME、
> そして意図だけです。installできるpackageも、実行できるcommandもありません。

## これは何か

coding agentは「終わりました」と言えます。しかしそれを確定させることはできません。
判定される対象と判定する主体が、同じ仕組みだからです。

*exit criteria*（終了条件）は、ある作業を完了と宣言するために満たされていなければ
ならない条件を指す既存の用語です。考え方自体は新しくありません。足りていないのは、
その条件がたいてい散文で書かれ、一度読まれ、なんとなく合意され、機械的に確認され
ないまま終わることです。

このプロジェクトは、それを実行可能にします。

- 条件は作業を始める前に固定する
- agentは候補を提出でき、何度でも直せる
- **条件が成立したかどうかは機械が決める。agentは決めない**
- 実際に何を観測したかを記録する

## なぜ必要か

なくしたいのは、この往復です。

```text
「完了しました」→「動かないんだけど」→「完了しました」→「まだ動かない」→「完了しました」
```

この往復は毎回、人間の注意を消費します。条件を先に一度決めておけば、消費は一度で済みます。

## しないこと

- 条件そのものが良いかどうかは判定しません
- ソフトウェアが正しいことは証明しません
- 合否を言語モデルに尋ねることはしません

条件が甘ければ、通っても意味はほとんどありません。この限界は実在するので、
今後も文書に残し続けます。

## 現在の状態

| | |
|---|---|
| 実装 | なし |
| npm package | `exit-criteria` — 未登録・未公開 |
| ライセンス | MIT |

最初に実装する予定のcommandは、base branchに対する設定不要の検査です。まだ存在せず、
`npx exit-criteria` は何も解決しません。

## ライセンス

[MIT](LICENSE)
