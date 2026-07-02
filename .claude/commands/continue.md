---
description: Resume migration work in a new session with full context, no re-discovery needed.
---

## Purpose

Let a fresh session (no memory of prior ones) pick up exactly where the last one left off.

## Inputs

None required.

## Outputs

- A short restatement of current state (active module, what's done, what's next) so the user can confirm before work resumes.

## Steps

1. Read, in order: `../docs/migration/CURRENT_CONTEXT.md`, `../docs/migration/NEXT_TASK.md`, `../docs/migration/PROGRESS.md`.
2. Read `../.claude/context/KNOWN_ISSUES_AND_DEVIATIONS.md` and `../docs/migration/DECISIONS.md` for anything that changes how the next task should be approached.
3. Summarize back to the user: active module, what's done, what's left, any open blockers.
4. If `NEXT_TASK.md` is clear and unblocked, proceed directly into `/migrate` for that task. If it's ambiguous or blocked on an open decision, ask the user before proceeding.

## Expected Result

Work resumes with zero re-derivation of context already captured in `../docs/migration/`, and no silent assumptions about state that isn't actually current.
