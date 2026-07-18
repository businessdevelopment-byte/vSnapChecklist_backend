---
name: forms
description: Build every new/migrated form in ../frontend/ with react-hook-form + Zod — the current codebase mostly doesn't, and that's documented debt, not the pattern to copy.
---

## Purpose

Ensure migrated forms (of which there are many — OTP/PMS/Political each have per-stage modal forms, HR has a dozen more) are built the *intended* way, not the way most existing non-auth forms happen to be built today.

## When to Use

- Any new form, or any form being migrated from `Master`, in `../frontend/`.

## Rules

- Use `react-hook-form` with `zodResolver`, matching `../frontend/src/features/auth/components/MainLogin.tsx` / `MainSignup.tsx` — this is currently the **only** place this pattern is actually used; every other existing form uses manual `useState` + ad hoc validation (`../.claude/context/KNOWN_ISSUES_AND_DEVIATIONS.md` #2). Don't copy the manual pattern just because it's more common today.
- Define the schema in `../frontend/src/schemas/[domain].schemas.ts`. Check `task.schemas.ts` and `common.schemas.ts` first — they're currently unused but may already model what a new form needs (createTemplateSchema, createDelegationSchema, submitChecklistSchema, submitDelegationSchema, transferSchema, paginationSchema, dateFilterSchema).
- Wire field-level errors via `formState.errors` and `aria-invalid`, matching the existing login form's accessibility pattern.
- Toast on submit failure/success via Sonner, never `alert()`.
- Every field the form submits must correspond to a real field the this repo endpoint accepts (check its Zod schema in `src/schemas/`) — a form field with nowhere to persist is a red flag, not a detail to skip.

## Best Practices

- When porting a form from `Master`, extract its exact fields and any conditional-field logic (e.g. HR Call Tracker's "Next Call Date" field only appearing when status is "Call Back Later") into the Zod schema / RHF `watch()`, not ad hoc JSX conditionals guessing at the rule.
- For multi-step or dual-mode forms (like `Master`'s Assign Task, which switches between Checklist/Delegation modes), model the mode switch explicitly rather than one giant schema with everything optional.
- Centralize computed fields' formulas (GST 18%, payroll gross/net, leave day-count) as pure functions used by the schema/hook, not recomputed inline in JSX.

## Common Mistakes

- Defaulting to manual `useState` validation because "that's what most forms in this app do" — that's the debt this skill exists to stop replicating.
- Leaving `task.schemas.ts`/`common.schemas.ts` unused and writing a duplicate schema instead of checking them first.
- Porting a `Master` form's fake `console.log`-only save handler as if it were the real persistence behavior — wire it to a real mutation hitting a real this repo endpoint.

## Verification Checklist

- [ ] Uses `react-hook-form` + `zodResolver`
- [ ] Schema lives in `../frontend/src/schemas/`, reusing an existing one if it already fits
- [ ] Field errors shown with `aria-invalid` + associated message
- [ ] Success/failure feedback via Sonner toast
- [ ] Conditional fields and computed formulas match the exact source logic in `Master`
- [ ] Every submitted field has a real backend field to land in
