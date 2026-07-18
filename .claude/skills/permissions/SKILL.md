---
name: permissions
description: Work correctly within the current single-boolean RBAC model across ../frontend/ and , and don't migrate any of Master's three conflicting permission systems without an explicit decision.
---

## Purpose

Avoid quietly reintroducing permission complexity (or inconsistency) that hasn't been designed for, given that three different, unreconciled permission systems currently exist across the workspace.

## When to Use

- Any feature with role-based visibility or admin-only actions, in either `../frontend/` or this repo.
- Any migration work touching HR, Global Settings, or `Master`'s `/vsnap/settings` — all three have their own user/permission notions.

## Rules

- Today's actual model, everywhere in `vsnapChecklist`: `Role = "ADMIN" | "USER"` (`../frontend/src/types/global.d.ts`, `backend`'s Prisma `Role` enum). Frontend reads it via `useRBAC()` → `{ user, isAdmin }`. That's it — no granular permissions, no permission constants file.
- Backend enforcement is inline per-controller/service (`if (req.user!.role !== "ADMIN")`), not middleware. When adding a new admin-only endpoint in this repo, follow this same inline pattern for consistency (`../.claude/context/BACKEND_API_REFERENCE.md`).
- **Do not port any of `Master`'s permission systems as-is**: its global `/settings` `accessPages: string[]` model and its separate `/vsnap/settings` `{admin, superadmin, hod, user}` role list are both unreconciled with each other and with the real backend's `Role` enum. Which becomes canonical (if any additional granularity is even needed) is an open decision — see `../docs/migration/DECISIONS.md`. Do not migrate any RBAC-dependent module until it's resolved.
- Frontend permission checks are UI-only (hide/show) — never treat them as security. Any new admin-only action needs a matching server-side check in this repo.

## Best Practices

- If a migrated module's source in `Master` implies a need for more granular permissions than ADMIN/USER (e.g. department-scoped access, multi-tier roles like `hod`), surface that explicitly as an open question rather than quietly implementing your own scheme.
- Reuse the existing `isAdmin` boolean and `NAV`-array-with-`adminOnly?` pattern (from `../frontend/src/features/checklist/settings/components/MainSettings.tsx`) as the reference shape if a similar admin-only nav/section is needed elsewhere.

## Common Mistakes

- Introducing a new role/permission enum without reconciling it against the existing `Role` enum and the open decision in `../docs/migration/DECISIONS.md`.
- Trusting a frontend `isAdmin` check alone to protect a new admin-only mutation, without a matching backend check.
- Copying `Master`'s inconsistent role casing (`'admin'` vs `'ADMIN'` vs `'hod'`) into new code.

## Verification Checklist

- [ ] Uses the existing `Role`/`useRBAC()` model, not a new invented one
- [ ] Any new admin-only action is checked server-side in this repo, not just hidden client-side
- [ ] No permission model from `Master` ported without a `../docs/migration/DECISIONS.md` entry
- [ ] Role values match the existing `Role` enum casing exactly
