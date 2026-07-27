# Demo 0002 — Walking skeleton

The first task where Exit Criteria existed while it ran. The tool read the frozen
conditions from the real GTP Contract, ran the bound checks, and decided the outcome
from exit codes.

It also stalled once, for a reason that turned out to be wrong. That is recorded here
in full, because the stall was more informative than the run.

- Task: [issue #2](https://github.com/agent-operated/exit-criteria/issues/2)
- Date: 2026-07-27
- GTP: `1.0.4`, Record protocol `1.1`
- Result: `done`, no halt at any point

---

## Simulated

Exit Criteria cannot yet propose conditions or take a selection, so that part was
still done by hand. Everything after the freeze was real.

**en**

```text
you: build the walking skeleton for issue #2

exit-criteria: define the exit criteria

  1. the whole path fires end to end against the real issue   (recommended)
  2. an input that cannot be acquired never counts as a pass   (recommended)
  3. a condition with no binding is never silently skipped     (recommended)
  4. the decision path does not consult a model                (recommended)
  5. other (type it)

you: all of them

exit-criteria: frozen as the GTP Contract's done_conditions.
               contract c081e922-4ba6-4912-b3f2-4def2ea5a741
```

**ja**

```text
ユーザー: issue #2 の walking skeleton を作って

exit-criteria: 完了条件を定義してください

  1. 実Issueに対して経路が端から端まで発火する      （推奨）
  2. 取得できない入力を合格に数えない               （推奨）
  3. 束縛のない条件を黙って飛ばさない               （推奨）
  4. 合否の経路がモデルを使わない                   （推奨）
  5. その他（入力）

ユーザー: 全部

exit-criteria: GTP Contract の done_conditions として固定します。
```

---

## Frozen

**The freeze mechanism changed from demo 0001.** There, the criteria lived in a separate
file and were held in place by a digest that had to be re-checked. Here they live in the
GTP Contract, and GTP itself refuses redefinition:

> 既存condition ID、`text`、`evidence_kind`の再定義、変更、削除を認めない。

No digest of our own, no re-check step, no second contract. The immutability is the
protocol's, not ours.

| condition | evidence kind |
|---|---|
| `end_to_end` | check |
| `unavailable_is_not_pass` | check |
| `binding_required` | check |
| `decision_has_no_model` | check |

```text
contract  c081e922-4ba6-4912-b3f2-4def2ea5a741
scope     package.json  package-lock.json  tsconfig.json
          src/  test/  exit-criteria.yml
```

---

## Observed

### Protocol transitions

```text
unmanaged  ──post_contract──▶  ready  ──post_start──▶  in_progress
           ──post_done──▶  await_merge  ──native merge──▶  done

halt_reason: none at any point
acquisition: complete at every reading
```

### The run at the candidate head

```console
$ node dist/src/cli.js --json      # head d006be1
PASS  binding_required         exit 0
PASS  decision_has_no_model     exit 0
PASS  end_to_end                exit 0
PASS  unavailable_is_not_pass   exit 0
run: PASS
```

```console
$ npm test
tests 15   pass 15   fail 0
```

Three of the fifteen are end-to-end: they spawn the built CLI, which calls the real GTP
CLI against the real issue.

### Merge gates

```text
scope             16 files changed, 0 outside the Contract scope
unsafe values     44,813 bytes of patch scanned, 0 findings
mergeable         true, clean
check runs        4 completed/success at the exact head
merge             41bb3208b8d58995f1914d58bf21e47a3f3ae15d
```

### What each Check Run records

```text
candidate_head_sha           d006be1c965738ad3b0809f9a1b44f8e245541ba
binding_source               exit-criteria.yml
binding_blob_sha             20aa37ff3293da798f452acbe199e73e062c831d
executed_argv                node --test dist/test/...
exit_code                    0
check_run_producer           the exit-criteria CLI, run locally by the same
                             actor that authored the candidate
verification_paths_changed   yes — exit-criteria.yml and test/ were added by
                             this same pull request
```

No `independent: true`. No `trusted: true`. The last two lines say plainly that this run
was a self-check.

### What this PASS covers

> The path fetched the conditions from GTP, ran real commands, consulted no model, and
> returned PASS / FAIL / UNAVAILABLE at the candidate head.

Not the independence of the checks. Not whether each check is an adequate test of its
condition text. Not authority, review, or merge enforcement.

---

## Findings

### F-1 — A value was frozen without reading its definition

`evidence_kind` accepts `check` or `artifact`. The Contract was drafted with `check` on
all four conditions after reading the Contract schema, without reading what `check`
means. It is defined two sections later:

> `check`は同じrepositoryのGitHub Check Runで、`status: completed`、`conclusion: success`、`head_sha == done.head_sha`を満たす。

The definition was in the specification already installed and partly read. Freezing a
contract whose values had not been looked up is the root cause of everything in F-2.

**Rule taken from this:** before freezing, every closed-vocabulary value in the contract
gets its definition quoted next to it. Not paraphrased — quoted.

### F-2 — Work stopped on a requirement that was never frozen

At Done time the reasoning ran: `check` means a Check Run, this repository has no CI,
therefore the Contract cannot be satisfied. Then, after finding that a Check Run *could*
be created directly: creating it would make the agent its own witness, so stop and ask.

Both steps were wrong.

- GTP defines Done as `自主検査記録` and states outright that it is *not* an independent
  inspector's approval. Self-checking is the documented shape of a Done Record.
- `check` is a **resource kind** — which URL the evidence points at. It says nothing about
  who runs the verification or whether CI exists.
- The Contract required a deterministic machine decision. It did not require independent
  verification. That requirement was imported afterwards and then enforced as if the
  protocol had demanded it.

**A blocker was manufactured from a requirement nobody had agreed to.** That is worse than
missing a real one: it stops work while looking principled.

**Rule taken from this:** a stop must name the frozen line it is protecting. If the
requirement cannot be quoted from the contract, it is a proposal for the next contract,
not a blocker for this one.

### F-3 — A binding invariant was read as a repository-wide restriction

`1 Issue = 1 branch = 1 PR` was treated as "this repository may not have concurrent work",
which ruled out the simplest option. The full line scopes it:

> 1 Issue = 1 branch = 1 PRとする。**分割、統合、別branch／PRへの移動**はStopと後継Issueを使う。

It fixes how one task binds. GTP states separately that it does not enable, disable or
change existing instructions and rules. Other tasks, branches and PRs are simply outside
what it tracks.

### F-4 — The real trust boundary is one step earlier than it looked

The question that mattered was never "who posts the Check Run". It is:

```text
GTP Contract       the condition text and evidence kind   frozen
exit-criteria.yml  the command that actually runs         written by this PR
test/              what that command asserts              written by this PR
```

The decision is deterministic — an exit code, no model. But the candidate defined what the
machine would look at. That gap is not closed by adding CI: if the same change can edit the
workflow, the bindings and the tests, moving the execution elsewhere changes the runner, not
the authority.

**GTP already has the mechanism.** A task whose Contract scope excludes `exit-criteria.yml`
and `test/` cannot modify them — the PR file list must fall inside scope, and a violation is
`invalid_binding`, a halt. The verification definition then belongs to an earlier, separately
approved task.

This task could not use it. A bootstrap builds the tool and its checks together; excluding
them from scope would leave nothing to build. **Bootstrap is the one case where separation is
impossible, and naming it is the honest handling** — not stopping, and not quietly claiming
independence that was not there.

### F-5 — A test conflated "cannot reach the subject" with "the subject is broken"

The anonymous GitHub API allows 60 reads an hour. It ran out mid-task. `gtp status` behaved
correctly — it refused to guess a state and reported `acquisition_incomplete` — and the CLI
reported every condition as UNAVAILABLE, also correct.

The end-to-end test then failed with `actual: []`, indistinguishable from broken wiring.

Fixed by asserting acquisition first and failing with the reason. The test still fails when
GitHub is unreachable, and that is right: a test that could not run its subject must not
report green. What changed is that it now says which of the two happened.

### Not a repeat of demo 0001

F-1 and F-2 in demo 0001 were about a check running over the wrong or empty data. It is
tempting to file today's under the same heading — "a green signal meant less than it looked
like" covers all of them.

It would misdirect the fix. Recording the observation denominator, which addresses both of
the earlier ones, would not have prevented anything here. Today's causes were an unread
definition and an imported requirement. Same shape at a distance, different repair.

### Two proposals withdrawn

Raised during the stall, both wrong:

- **A feasibility gate before freezing.** It would make this project an authority over
  whether a GTP Contract may be frozen, which contradicts its own stated limit that it does
  not judge whether the criteria are good. Validating configuration — bindings present,
  commands startable, inputs reachable — is useful and is a different thing from gating a
  freeze.
- **A fourth condition outcome for "the contract itself is unsatisfiable".** `UNAVAILABLE`
  already covers a missing binding or an unrunnable command. A defect in the contract
  configuration is not a condition's outcome; it belongs to a preflight, one layer up.
