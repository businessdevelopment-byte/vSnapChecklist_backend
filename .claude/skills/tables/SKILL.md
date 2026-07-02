---
name: tables
description: Build hand-rolled shadcn tables consistently in ../frontend/ across the many Pending/History pipeline tables coming from OTP/PMS/Political migration.
---

## Purpose

Keep the (numerous, repetitive) tables being migrated from `Master` consistent, since there's no table library doing this for you.

## When to Use

- Any table for a migrated or new feature in `../frontend/` — especially the Pending/History pattern repeated across OTP (11 stages), PMS (14 stages), and Political (14 stages).

## Rules

- No TanStack Table is installed. Build with stock shadcn `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`, following the pattern in `../frontend/src/features/checklist/checklistView/components/MainChecklist.tsx`.
- For paginated/infinite lists, use TanStack Query's `useInfiniteQuery` (see `checklistView`'s pattern), not a client-side-only array slice, if the dataset can grow large (PMS/Political seeded ~1000 rows in the prototype). This requires a real paginated this repo endpoint, not just a frontend slice.
- Column headers: `font-semibold text-xs uppercase tracking-wide whitespace-nowrap` per the existing style.
- Search/filter/sort state lives in the feature's `hooks/`, not inline in the component.

## Best Practices

- Since OTP/PMS/Political each need near-identical Pending/History tables, build the first one carefully and reuse it as the reference; once you've built 2-3, evaluate proposing a shared parameterized table component in `../docs/migration/DECISIONS.md` rather than hand-copying a 4th/5th/6th time.
- Match `Master`'s actual filter set per module (date range, search, dropdown filters) — cited in `../.claude/context/VITE_MODULE_INVENTORY.md` — don't drop or add filters without noting why.
- Use shadcn `Skeleton` rows during loading, not a spinner over the whole table.

## Common Mistakes

- Introducing TanStack Table without a `../docs/migration/DECISIONS.md` entry — it's a real architectural addition, not a drop-in.
- Loading an entire large dataset client-side instead of paginating, for the bigger pipeline tables.
- Losing a filter/sort/search capability that existed in the `Master` version without flagging it as an intentional scope decision.

## Verification Checklist

- [ ] Built with existing shadcn `Table` primitives (or a proposed+approved shared component)
- [ ] Pagination strategy matches expected data volume, backed by a real endpoint
- [ ] Filters match the source module's actual filters (or a documented, approved change)
- [ ] Skeleton loading state, not a spinner
