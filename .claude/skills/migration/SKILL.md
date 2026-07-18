---
name: migration
description: Port a module's business logic from the legacy Master (Vite) app into ../frontend/ (and this repo where needed), following the Observe-Analyze-Plan-Implement-Verify-Reflect-Document-Update loop.
---

## Purpose

Migrate one module at a time from `Master` (sibling directory to this `vsnapChecklist/` repo) into `../frontend/` + this repo, preserving real business logic while conforming entirely to each app's existing architecture — without hallucinating fields, endpoints, or rules that don't exist in any of the three codebases.

## When to Use

- Any time work begins on a module listed in `../docs/migration/MASTER_PLAN.md`.
- When resuming migration work in a new session (read `../docs/migration/CURRENT_CONTEXT.md` and `NEXT_TASK.md` first).

## Rules

- The existing architecture of `../frontend/` and this repo always wins — never restructure either to fit something from `Master`.
- `Master` contributes business logic only: forms, fields, workflows, tables, validation, business rules. Everything else (UI, state management, folder structure, naming) follows `../frontend/CLAUDE.md` and `CLAUDE.md` conventions.
- Follow the loop for every module, in order, without skipping steps:
  1. **Observe** — read the relevant `Master` source (cite file:line) and the closest existing analogous feature in `../frontend/`/this repo.
  2. **Analyze** — extract the real fields/forms/tables/business rules; cross-check against `../.claude/context/VITE_MODULE_INVENTORY.md`.
  3. **Plan** — decide the target feature-folder shape in `../frontend/`, and any new Prisma model/endpoint needed in this repo.
  4. **Implement** — build the frontend piece per `../frontend/CLAUDE.md` and the relevant skills; build the backend piece per `CLAUDE.md` and `../.claude/context/BACKEND_API_REFERENCE.md`.
  5. **Verify** — run the `verification` skill / `../docs/migration/VERIFY_CHECKLIST.md`, drive it in the browser.
  6. **Reflect** — note what deviated from plan or is still uncertain.
  7. **Document** — update `../docs/migration/CHANGELOG.md`, and `DECISIONS.md` if a tradeoff was made.
  8. **Update Progress** — update `../docs/migration/PROGRESS.md` and `CURRENT_CONTEXT.md`.
  9. **Repeat** for the next module in `NEXT_TASK.md`.
- Never assume an API endpoint, Prisma field, or permission exists — verify against `../.claude/context/BACKEND_API_REFERENCE.md` or the actual schema/code.
- Never invent a business rule — port the exact formula/logic found in `Master`, cited by file path.
- If information is missing from all three codebases, ask the user — don't guess and proceed.

## Best Practices

- Treat installed-but-unused dependencies in `Master` (react-query, zustand, zod, react-hook-form, xlsx, etc.) as signals of *intended* future architecture, not evidence of current behavior — verify actual usage with a grep first.
- Distinguish real persistence from UI stubs in `Master` — many "Save" buttons only `console.log`. Check before treating a flow as fully specified.
- When a module needs a backend that doesn't exist yet (OTP/PMS/Political/HR/MIS all currently lack real Postgres-backed models), design the Prisma model in `prisma/schema.prisma` following the existing Controller→Service→Prisma layering and naming conventions.
- Centralize repeated magic numbers/logic found during extraction (e.g. OTP's hardcoded 18% GST) into named constants in the new code.
- Frontend and backend pieces of the same module are usually implemented together in the same migration cycle — don't leave one half undone across sessions without noting it in `CURRENT_CONTEXT.md`.

## Common Mistakes

- Copying `Master`'s UI pixel-for-pixel instead of reimplementing with shadcn/ui and `frontend`'s shared layout.
- Marking a module "Done" without running `VERIFY_CHECKLIST.md`.
- Skipping the Document/Update Progress steps because "it's obvious" — the next session has no memory of this one.
- Migrating a module that depends on an unresolved open decision (e.g. anything RBAC-dependent, pending the three-permission-systems reconciliation in `../docs/migration/DECISIONS.md`).
- Silently changing scope (adding/dropping a module) instead of updating `MASTER_PLAN.md` and flagging it to the user.
- Putting backend logic inside `../frontend/` or frontend logic inside this repo — they're separate repos with separate rules.

## Verification Checklist

- [ ] Loop followed in full for this module (no step skipped)
- [ ] Business logic matches the cited `Master` source exactly, or a deviation is logged in `DECISIONS.md`
- [ ] `../docs/migration/VERIFY_CHECKLIST.md` passes
- [ ] `PROGRESS.md`, `CURRENT_CONTEXT.md`, `CHANGELOG.md` updated
- [ ] No invented endpoints/fields/permissions — everything traces to a real file
- [ ] Frontend and backend changes each landed in the correct repo
