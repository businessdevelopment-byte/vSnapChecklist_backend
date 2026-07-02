---
name: typescript
description: TypeScript conventions for both the strict-mode frontend and backend — ambient global types, no any, and how to handle types for not-yet-existing backend models.
---

## Purpose

Keep type usage consistent and honest in both `../frontend/` and this repo — especially important during migration, when new domains (OTP/PMS/Political/HR/MIS) don't have backend types yet.

## When to Use

- Writing any new `.ts`/`.tsx` file in `../frontend/` or `.ts` file in this repo.
- Defining a frontend feature's `types/types.ts`.
- Typing a new API response before the backend model actually exists.

## Rules

- Both repos have `strict: true` — never add `// @ts-ignore` to silence a real error; fix the type.
- No `any`. Use `unknown` + narrowing if a type is genuinely not known yet.
- Frontend: use the ambient globals in `../frontend/src/types/global.d.ts` (`ApiResponse<T>`, `PaginatedApiResponse<T>`, `Role`, `Frequency`) — they need no import. Feature-local types go in `types/types.ts` (lowercase filename, per naming convention).
- Backend: types generally come from Prisma's generated client; don't hand-roll a type that duplicates a Prisma model shape.
- No extra strictness flags are enabled beyond base `strict` in `../frontend/tsconfig.json` (no `noUncheckedIndexedAccess`, no `exactOptionalPropertyTypes`) — don't assume they're on when reasoning about index access safety.

## Best Practices

- When a migrated feature needs a type for a backend model that doesn't exist yet, define the type in the feature's `types/types.ts` based on what's actually needed by the UI/business logic — then flag in `../docs/migration/DECISIONS.md` that a matching Prisma model/endpoint is needed in this repo, rather than silently assuming the backend already returns that shape.
- Reuse `Role`/`Frequency` ambient enums instead of redefining them locally.
- Prefer precise union types (matching real backend enums like `DelegationStatus`) over loose `string`.

## Common Mistakes

- Inventing a field on `ApiResponse<T>`'s `data` payload that the actual backend endpoint doesn't return — check `../.claude/context/BACKEND_API_REFERENCE.md` first.
- Widening a type to `any`/`unknown` just to make a build error go away instead of fixing the underlying mismatch.
- Duplicating `Role`/`Frequency` locally instead of using the global ambient types.
- Hand-defining a backend model's shape in the frontend instead of deriving it from what the actual endpoint returns.

## Verification Checklist

- [ ] No `any`, no unjustified `@ts-ignore`
- [ ] Ambient globals reused where applicable
- [ ] New types trace to a real backend shape or are flagged as "needs backend support" in `DECISIONS.md`
- [ ] `tsc`/build passes with no new errors in the relevant repo
