---
name: react
description: Component/hook composition conventions in ../frontend/ — where state lives, how features call each other, and the client-component boundary.
---

## Purpose

Keep React code in `../frontend/` composed the way the codebase already does it: components render, hooks own logic, server state comes from TanStack Query.

## When to Use

- Writing any new component or hook in `../frontend/`.
- Deciding whether something is client or server-rendered.
- Deciding whether a hook belongs at the feature level or should be lifted to `../frontend/src/hooks/`.

## Rules

- Functional components, hooks only — no class components.
- `"use client"` on any component using hooks, state, or event handlers (the norm for `Main*` feature components).
- A feature's `hooks/useX.ts` composes `server/tanstackQuery/` hooks and returns a clean interface — components never import `server/api/` or `axiosInstance` directly.
- Global, cross-feature hooks (like `useRBAC`, `useOrgSettings`) live in `../frontend/src/hooks/`, not inside a feature folder.
- No Context API is used anywhere in `../frontend/` (`src/contexts/` is an empty, unused scaffold) — don't introduce a new Context provider without a `../docs/migration/DECISIONS.md` entry justifying it over TanStack Query/local state.

## Best Practices

- Derive values from query data instead of copying them into `useState` and letting them go stale.
- It's an established, accepted pattern for one feature's hook to import another feature's query hook/keys (e.g. `assignTask` invalidating `checklistKeys.all`) — don't over-engineer isolation that the codebase doesn't actually have.
- Use shadcn's `Skeleton` for loading states, not spinners.

## Common Mistakes

- Fetching data directly inside a component with `useEffect` instead of a TanStack Query hook.
- Forgetting `"use client"` on a component that ends up using `useState`/`useEffect`.
- Reintroducing Context API or a new state library "for convenience" when local state + TanStack Query already covers it.

## Verification Checklist

- [ ] Components contain no direct API calls
- [ ] Client components have `"use client"` where needed
- [ ] No new global state library/Context introduced without justification
- [ ] Loading states use skeletons, not spinners
