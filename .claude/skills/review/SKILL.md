---
name: review
description: Review a diff (own work or another session's) against this workspace's CLAUDE.md rules and known deviations before it's considered finished.
---

## Purpose

Catch architecture drift, invented facts, and rule violations before a change is considered complete — a lightweight, project-specific pass on top of general code review. Applies to changes in `../frontend/`, this repo, or the root migration docs.

## When to Use

- After implementing a migrated module, before running `verification`.
- When asked to review someone else's (or a prior session's) changes in this workspace.
- Before updating `../docs/migration/PROGRESS.md` to `Done`.

## Rules

- Check every changed file against the relevant repo's rules: `../frontend/CLAUDE.md` for frontend changes, `CLAUDE.md` for backend changes — don't review in a vacuum.
- Flag any invented API endpoint, Prisma field, permission, or business rule — cross-check against `../.claude/context/BACKEND_API_REFERENCE.md` and `VITE_MODULE_INVENTORY.md`.
- Flag any new global state, new dependency, or new shared abstraction that isn't justified by an existing `../docs/migration/DECISIONS.md` entry.
- Flag business logic placed in `components/` instead of `hooks/`/`server/` (frontend) or in controllers instead of services (backend).
- Check that `page.tsx` files remain thin.
- Flag anything landed in the wrong repo (backend logic inside `../frontend/`, or vice versa).

## Best Practices

- Prefer citing the exact rule violated (with the file and section name, e.g. "../frontend/CLAUDE.md § Form Rules") over a vague "this looks off."
- When a deviation from the documented pattern is found, check `../.claude/context/KNOWN_ISSUES_AND_DEVIATIONS.md` first — it may be pre-existing legacy debt, not a new regression; note which it is.
- Prioritize correctness/security issues (invented auth logic, missing server-side permission mirror) over style nits.

## Common Mistakes

- Approving a form that doesn't use react-hook-form + Zod because "other forms in the app don't either" — that's documented debt, not license to add more (`../frontend/CLAUDE.md` Form Rules).
- Missing a hardcoded business constant (e.g. GST %) that should have been centralized.
- Not checking whether a new admin-only action has a matching server-side check in this repo, not just a frontend `isAdmin` hide.

## Verification Checklist

- [ ] Matches feature-folder pattern (frontend) / Controller-Service-Prisma pattern (backend)
- [ ] No invented endpoints/fields/permissions/business rules
- [ ] Forms use RHF + Zod
- [ ] All HTTP via `axiosInstance`
- [ ] No logic in `page.tsx` or `components/`
- [ ] New abstractions/dependencies have a `../docs/migration/DECISIONS.md` entry
- [ ] Admin-only actions are checked server-side, not just hidden client-side
- [ ] Changes landed in the correct repo
