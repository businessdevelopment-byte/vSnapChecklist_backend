---
name: verification
description: Verify a migrated or new feature actually works end-to-end before marking it done — no test framework exists, so this means driving it in the browser plus typecheck/build/lint.
---

## Purpose

Prevent "looks right in the diff" from being mistaken for "done." Neither `../frontend/` nor this repo has a test framework installed, so verification is manual and must be thorough.

## When to Use

- Before marking any module `Done` in `../docs/migration/PROGRESS.md`.
- Before ending a migration session, on whatever was completed during it.
- After any change to shared code (`../frontend/src/components/ui/`, `DashboardLayout`, `axiosInstance`, `../frontend/src/hooks/`, or `src/middleware/`) that could affect multiple features.

## Rules

- Run through the full `../docs/migration/VERIFY_CHECKLIST.md` for the specific module — don't spot-check.
- Actually start both dev servers (`frontend`: `npm run dev`, `backend`: `npm run dev`) and exercise the feature in a browser (golden path + edge cases) — reading the code is not verification.
- Run `tsc`/the Next.js build in `../frontend/`, and the TypeScript build in this repo; confirm no new errors in either.
- No test framework exists in either repo (no Jest/Vitest/Playwright/RTL) — do not claim "tests pass" when none exist; say explicitly what was and wasn't checked.
- Confirm behavior against the cited `Master` source (`../.claude/context/VITE_MODULE_INVENTORY.md`) — a faithful port should reproduce the same real behavior (not the same UI-only stub behavior, per `migration` skill).

## Best Practices

- Check both roles (ADMIN and USER) when a feature has any `isAdmin` gating, on both the frontend hide/show and the backend enforcement.
- Check loading, empty, and error states, not just the happy path with data present.
- For anything migrated from a pipeline module (OTP/PMS/Political), verify the stage-advance logic moves data correctly between Pending/History via the real backend endpoint, not just that the form submits.
- Re-verify a feature after any shared-code change that touches it, even if the feature itself wasn't the target of that change.

## Common Mistakes

- Marking something verified after only a visual screenshot check.
- Skipping error-state/permission-boundary checks because the happy path worked.
- Assuming lint is enforcing conventions in `../frontend/` — no ESLint config file currently exists there (`../.claude/context/KNOWN_ISSUES_AND_DEVIATIONS.md` #6), so `npm run lint` isn't a meaningful gate today; don't cite it as verification evidence until that's fixed.
- Forgetting to check the specific business-rule math (GST, payroll gross/net, leave day-count) against the exact formula in the source, not an approximation.
- Verifying only the frontend half of a module and assuming the backend endpoint "probably works."

## Verification Checklist

Use `../docs/migration/VERIFY_CHECKLIST.md` as the canonical, per-module list (Routes, Navigation, Forms, Dialogs, Drawers, Tables, Columns, Filters, Sorting, Search, Pagination, Validation, Permissions, Business Rules, API Calls, Loading, Error States, Responsive, Accessibility, Performance, TypeScript, Lint, Build). This skill exists to make sure that checklist actually gets run, not to duplicate it.
