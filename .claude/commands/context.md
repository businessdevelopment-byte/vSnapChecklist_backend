---
description: Refresh ../docs/migration/CURRENT_CONTEXT.md to reflect actual current state.
---

## Purpose

Keep `CURRENT_CONTEXT.md` honest and current — it's the first thing read at the start of every session (`/continue`), so it must never describe stale state.

## Inputs

None required — infer current state from the session's own work, or ask the user if resuming cold with no session history.

## Outputs

- An updated `../docs/migration/CURRENT_CONTEXT.md` with: Active Module, Current Folder/Page/Component/Step, Completed Work, Remaining Work, Known Blockers/Open Questions, Current Decisions, Current Status, Next Action, Last Updated (date).

## Steps

1. Determine what module/task is actually active right now (not what was planned at session start, if it changed).
2. List what's concretely done vs. remaining within that module, across both `../frontend/` and this repo if applicable.
3. List any blockers — including open items in `../docs/migration/DECISIONS.md` that are stalling progress.
4. Set "Next Action" to exactly what `/continue` should do next — specific enough that no re-investigation is needed.
5. Write the file, overwriting stale content rather than appending to it (this file describes a point-in-time snapshot, not a log — `CHANGELOG.md` is the log).

## Expected Result

A future session (or `/continue`) can resume instantly from this file alone, with no guessing.
