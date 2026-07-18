---
description: Review the current diff (or a specified module) against the relevant CLAUDE.md rules and known deviations.
---

## Purpose

A project-specific code review pass, per the `review` skill — catch architecture drift and invented facts before calling something finished.

## Inputs

- Optional: a specific module/path to review. If omitted, review the current uncommitted diff (check `../frontend/`, this repo, and root separately — they're different git repos).

## Outputs

- A list of findings, each citing the specific rule (from `../frontend/CLAUDE.md`, `CLAUDE.md`, or a `../.claude/context/` fact) it's checked against.

## Steps

1. Identify the diff or module in scope (`git status`/`git diff` in each relevant sub-repo, or the named module's files).
2. Check folder shape against the `architecture` skill.
3. Check forms against the `forms` skill (RHF + Zod, not manual `useState`).
4. Check API calls against `../frontend/CLAUDE.md` § API Rules and `../.claude/context/BACKEND_API_REFERENCE.md` (no invented endpoints/fields).
5. Check permission logic against the `permissions` skill (no new ad hoc role system, server-side mirror exists for admin actions).
6. Check for invented business rules — cross-reference `../.claude/context/VITE_MODULE_INVENTORY.md`.
7. Distinguish pre-existing legacy debt (`../.claude/context/KNOWN_ISSUES_AND_DEVIATIONS.md`) from new regressions — don't flag the former as new issues, but don't let new code copy it either.
8. Report findings ranked by severity (correctness/security first, then convention drift, then style).

## Expected Result

A concrete finding list (or "no issues found") the user can act on before merging/committing — not a vague "looks good."
