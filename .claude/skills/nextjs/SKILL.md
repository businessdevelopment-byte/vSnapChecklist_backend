---
name: nextjs
description: App Router, routing groups, and rendering conventions specific to ../frontend/ — including the real gap in route protection.
---

## Purpose

Add new routes/pages in `../frontend/` consistently with the existing App Router structure, and don't assume protections exist that don't.

## When to Use

- Adding a new page in `../frontend/` for a migrated module (e.g. `/pms/sales-team`, `/hr/payroll`).
- Deciding whether a page needs a new route group or fits the existing `(dashboard)/(system)` group.

## Rules

- App Router only, in `../frontend/src/app/`. New authenticated pages go inside `(dashboard)/(system)`, which already wraps children in `<DashboardLayout>`.
- `page.tsx` = thin wrapper only: `import MainX from "@/features/.../components/MainX"; export default function XPage() { return <MainX />; }` — zero exceptions exist today, keep it that way.
- Route segments are kebab-case (`assign-task`, not `AssignTask` or `Assign Task` — normalize any spaced folder names coming from `Master`).
- **No `middleware.ts` exists.** Don't write code that assumes server-side route protection is in place — today, an unauthenticated user can render any dashboard page client-side until an API call 401s and bounces them. If a migrated module needs real protection, raise it explicitly rather than assuming it's already handled.

## Best Practices

- For a new multi-stage pipeline system (PMS/Political-style), consider whether each stage needs its own top-level route (matching `Master`'s `/pms/sales-team` style) or can be a tab within one route — check `../docs/migration/MASTER_PLAN.md`/ask before deciding, since it affects the whole system's route count.
- Keep `layout.tsx` files minimal — the existing dashboard layout only wraps children in `<DashboardLayout>`, no auth logic lives there today.

## Common Mistakes

- Adding logic/data-fetching to a `page.tsx`.
- Assuming `/` performs an auth check before redirecting — it doesn't; it's an unconditional `redirect("/dashboard")`.
- Creating route segment names with spaces or PascalCase, copying `Master`'s folder names literally.

## Verification Checklist

- [ ] New page is a thin wrapper only
- [ ] Route segment is kebab-case
- [ ] Placed in the correct route group
- [ ] No assumption of server-side auth protection that doesn't exist
