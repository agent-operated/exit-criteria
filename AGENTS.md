# Repository agent instructions

## GitHub Task Protocol

このrepositoryはrootの[`GTP.md`](GTP.md)（GTP 2.0、pinned tag `v2.0.0`）をDecision Recordのprotocol正本とする。適用手順は[`skills/gtp/SKILL.md`](skills/gtp/SKILL.md)にある。

後から変更するコストまたは影響が大きい未決定事項が生じ、既存の指示・仕様・Decision Recordから手段が一意に決まらない場合だけ、[`gtp/decisions/`](gtp/decisions/)へDecision Recordを作成または更新し、成果物の変更からそのRecordへ一方向に参照する。

GTPは作業状態、完了判定、Evidence集約、承認、権限、workflow制御、強制機構を持たない。GTPの表示やDecision Recordは、変更・完了・mergeの権限を与えない。
