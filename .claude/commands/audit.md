---
description: Audit ../frontend/ and  (or a subset) against their CLAUDE.md files and refresh KNOWN_ISSUES_AND_DEVIATIONS.md.
---

## Purpose

Periodically re-verify that the codebase still matches what `../frontend/CLAUDE.md`, `CLAUDE.md`, and `../.claude/context/` claim about it — catching drift that accumulated across several migration sessions.

## Inputs

- Optional scope (e.g. "audit the checklist feature" or "audit all migrated modules so far"). If omitted, audit both `../frontend/src/` and `src/`.

## Outputs

- An updated `../.claude/context/KNOWN_ISSUES_AND_DEVIATIONS.md` (new findings appended, stale ones marked resolved, nothing silently deleted).
- A summary of anything materially wrong (invented endpoints in use, permission gaps, broken business logic) versus cosmetic drift.

## Steps

1. Re-verify the claims in `../.claude/context/NEXTJS_ARCHITECTURE.md` and `BACKEND_API_REFERENCE.md` are still accurate — spot-check folder structure, providers, auth flow, route list in both repos.
2. Grep for patterns that shouldn't exist per `../frontend/CLAUDE.md`/`CLAUDE.md` (plain `axios`/`fetch` imports outside `axiosInstance`, `alert()`/`confirm()`, inline styles, `any` types, new global state libraries, `prisma.*` calls inside controllers).
3. Check `../docs/migration/PROGRESS.md` modules marked `Done` still actually pass `VERIFY_CHECKLIST.md` (spot-check, not necessarily every one).
4. Update `../.claude/context/KNOWN_ISSUES_AND_DEVIATIONS.md` with any new findings; mark resolved items as resolved (don't delete history).
5. Report a summary to the user, prioritized by severity.

## Expected Result

`../.claude/context/`, `../frontend/CLAUDE.md`, and `CLAUDE.md` remain trustworthy as ground truth — the audit either confirms that or produces a concrete, prioritized fix list.
