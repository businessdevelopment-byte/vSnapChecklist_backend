---
description: Run the full verification checklist against a module before it's marked Done.
---

## Purpose

Apply `../docs/migration/VERIFY_CHECKLIST.md` thoroughly to a specific module, per the `verification` skill — actually exercising it, not just reading the code.

## Inputs

- The module/feature to verify (name or route). If omitted, verify whatever was most recently implemented in this session.

## Outputs

- A pass/fail report against every line of `../docs/migration/VERIFY_CHECKLIST.md`, with specifics (not just checkmarks) for anything that failed or couldn't be checked.
- If the dev servers can be started, an actual browser exercise of the golden path + edge cases.

## Steps

1. Start the dev servers if not already running (`npm run dev` in `../frontend/`, and in this repo if the feature calls it).
2. Work through `../docs/migration/VERIFY_CHECKLIST.md` section by section: Structure, Data & State, UI, Functional, Bookkeeping.
3. Compare actual behavior against the cited business rules/fields in `../.claude/context/VITE_MODULE_INVENTORY.md` for this module.
4. Run `tsc`/the Next.js build in `../frontend/` and the build in this repo; note any errors.
5. Explicitly state that no automated test suite exists in either repo (`../.claude/context/KNOWN_ISSUES_AND_DEVIATIONS.md` #7) rather than implying tests were run.
6. Report failures with enough detail to act on (what was checked, what happened, what was expected).

## Expected Result

A clear, itemized verification report. If everything passes, the module is safe to mark `Done` in `../docs/migration/PROGRESS.md`. If anything fails, it stays `In review` and the failures are listed in `CURRENT_CONTEXT.md`'s "Known Blockers" section.
