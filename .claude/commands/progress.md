---
description: Report current migration progress across all modules.
---

## Purpose

Give a fast, accurate status snapshot without re-deriving it from scratch — useful for the user checking in on migration state.

## Inputs

None required.

## Outputs

- A summary: overall % complete, per-system status (OTP/PMS/Political/HR/MIS), what's actively in progress, what's blocked and why.

## Steps

1. Read `../docs/migration/PROGRESS.md` and `COMPLETED_MODULES.md`.
2. Read `../docs/migration/CURRENT_CONTEXT.md` for the active module's in-flight detail.
3. Read `../docs/migration/DECISIONS.md` for any open questions currently blocking modules (e.g. RBAC reconciliation blocking any permission-dependent module).
4. Present a concise table or summary: system → modules done / in progress / not started / blocked, plus the single next recommended action.

## Expected Result

The user gets an accurate, current picture of migration status without needing to open every tracking file themselves.
