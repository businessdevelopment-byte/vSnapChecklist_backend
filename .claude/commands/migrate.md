---
description: Migrate the next (or a specified) module from Master into ../frontend/ + , following the migration loop.
---

## Purpose

Drive one full migration cycle for a module — Observe, Analyze, Plan, Implement, Verify, Reflect, Document, Update Progress — per the `migration` skill.

## Inputs

- Optional: a specific module name/route (e.g. `/migrate PMS Sales Team`). If omitted, use the module in `../docs/migration/NEXT_TASK.md`.

## Outputs

- Implemented feature code under `../frontend/src/features/...` (and any new backend model/endpoint under this repo if needed).
- Updated `../docs/migration/PROGRESS.md`, `CURRENT_CONTEXT.md`, `CHANGELOG.md`, and `DECISIONS.md` (if a tradeoff was made).

## Steps

1. Read `../docs/migration/MASTER_PLAN.md`, `CURRENT_CONTEXT.md`, and `NEXT_TASK.md` to confirm the target module and scope.
2. Read `../.claude/context/VITE_MODULE_INVENTORY.md` for the module's real fields/forms/tables/business rules, then open the actual `Master` source files cited there (`Master/` is a sibling directory to this `vsnapChecklist/` repo) — don't rely on the summary alone for anything you're about to implement.
3. Check `../.claude/context/KNOWN_ISSUES_AND_DEVIATIONS.md` and `../docs/migration/DECISIONS.md` for anything that blocks or constrains this module (e.g. unresolved RBAC reconciliation).
4. If the module needs backend support that doesn't exist yet, design the Prisma model/endpoint in this repo per `../.claude/context/BACKEND_API_REFERENCE.md`'s existing conventions — confirm with the user before altering the schema if the change is non-trivial.
5. Implement the frontend piece in `../frontend/` following `../frontend/CLAUDE.md` and the `architecture`, `nextjs`, `react`, `forms`, `tables`, `shadcn`, `permissions` skills as relevant. Implement the backend piece in this repo following `CLAUDE.md`.
6. Run `/verify` for this module.
7. Update `../docs/migration/CHANGELOG.md`, `PROGRESS.md`, `CURRENT_CONTEXT.md`, and `DECISIONS.md` if applicable.
8. Report what was migrated, what was verified, and what (if anything) remains uncertain.

## Expected Result

The module is implemented per each repo's conventions, passes `../docs/migration/VERIFY_CHECKLIST.md`, and all tracking docs reflect the new state — a fresh session could pick up from here with no missing context.
