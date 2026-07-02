---
name: architecture
description: Ground the feature-folder architecture and overall app structure before adding or moving any code.
---

## Purpose

Keep every addition to `../frontend/` (the Next.js app) consistent with its existing feature-folder architecture, instead of each session inventing its own structure.

## When to Use

- Before creating a new feature or sub-feature folder in `../frontend/`.
- Before deciding where a piece of logic belongs (component vs hook vs server/api vs server/tanstackQuery).
- Before migrating a module from `Master` and choosing its target folder shape.

## Rules

- Every feature lives at `../frontend/src/features/[domain]/[subFeature]/` with: `components/`, `hooks/`, `server/api/`, `server/tanstackQuery/`, `types/types.ts`, `index.ts`.
- `components/` = JSX only, no Axios/API calls. `hooks/` = all state/effects/handlers. `server/api/` = Axios calls returning raw data. `server/tanstackQuery/` = query/mutation hooks + a query-key factory.
- Pages (`../frontend/src/app/**/page.tsx`) only import and render the feature's `Main*` component — zero logic.
- Full current-state map: `../.claude/context/NEXTJS_ARCHITECTURE.md`. Known deviations (features that don't fully follow this pattern): `../.claude/context/KNOWN_ISSUES_AND_DEVIATIONS.md` #1.
- If a module needs new backend models/endpoints, those live in this repo following its own Controller→Service→Prisma layering (`../.claude/context/BACKEND_API_REFERENCE.md`) — never put backend logic inside `../frontend/`.

## Best Practices

- Check whether a sibling feature already solves a similar problem before writing new code — features are allowed to cross-import each other's query hooks/keys (established pattern, see `assignTask` importing `checklistKeys`).
- For a genuinely repetitive shape (e.g. the OTP/PMS/Political pipeline stages), prefer one parameterized shared component over N near-identical copies — but propose it in `../docs/migration/DECISIONS.md` first.
- New static/simple pages may skip `hooks/`/`server/`/`types/` (like `license`, `trainingVideo`) only when there's genuinely no state or API call — don't use this as an excuse to skip the pattern for anything with real logic.

## Common Mistakes

- Copying `Master`'s flat, ad hoc folder structure instead of the feature-folder pattern.
- Putting an Axios call inside a `components/` file.
- Skipping `index.ts` — only `../frontend/src/features/auth` has one today; new features should still include it for consistency going forward unless told otherwise.
- Assuming every feature needs every sub-folder — check if the feature actually has server state/forms before creating empty `server/`/`hooks/` folders.
- Putting new backend code inside `../frontend/` (or vice versa) — they are separate git repos with separate conventions.

## Verification Checklist

- [ ] Folder shape matches the documented pattern (or a justified exception)
- [ ] No API calls in `components/`
- [ ] No business logic in `page.tsx`
- [ ] New shared abstractions are justified by 2+ real usages, not preemptive
- [ ] New code landed in the correct repo (`../frontend/` vs this repo)
