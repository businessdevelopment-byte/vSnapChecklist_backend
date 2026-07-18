---
name: documentation
description: Keep the three CLAUDE.md files (root/frontend/backend), ../.claude/context/, and ../docs/migration/ accurate and current — these are the only memory a future session has.
---

## Purpose

This workspace has no other persistence mechanism across sessions besides these files. Stale or missing documentation directly causes the next session to re-discover (or miss) the same landmine.

## When to Use

- Start and end of every migration session (`../docs/migration/CURRENT_CONTEXT.md`).
- After completing any module (`../docs/migration/CHANGELOG.md`, `PROGRESS.md`, `COMPLETED_MODULES.md`).
- After making any architectural tradeoff or discovering an open question (`../docs/migration/DECISIONS.md`).
- After discovering a new inconsistency between documented rules and actual code (`../.claude/context/KNOWN_ISSUES_AND_DEVIATIONS.md`).

## Rules

- There are **three** `CLAUDE.md` files, each scoped to what a session in that directory would see: root `CLAUDE.md` (cross-cutting migration process + workspace overview), `../frontend/CLAUDE.md` (Next.js-specific conventions), `CLAUDE.md` (Express/Prisma-specific conventions). Put a rule in the one it actually belongs to — don't duplicate wholesale across all three.
- `../frontend/CLAUDE.md`/`CLAUDE.md` describe the *target* pattern for their repo; `../.claude/context/KNOWN_ISSUES_AND_DEVIATIONS.md` (at root, shared by both) describes where reality currently diverges. Keep these in sync — if a rule stops matching the code, either fix the code or update the rule, don't let them silently contradict.
- `../docs/migration/CURRENT_CONTEXT.md` must reflect the actual state at the moment a session ends — not what was planned, what actually happened.
- `../docs/migration/CHANGELOG.md` entries describe *why* a change was made, not just what changed — the diff already shows what.
- `../docs/migration/DECISIONS.md` entries need: Context, Decision, Alternatives considered — a decision without the "why" can't be judged later when circumstances change.
- `.claude/skills/` and `.claude/commands/` exist in **three copies**: here at the root, `../frontend/.claude/`, and `.claude/` — required because Claude Code's skill/command discovery stops at the nearest `.git`, and `../frontend/`/this repo each have their own (see `../docs/migration/DECISIONS.md`). Edit the root copy first, then copy the change into both `../frontend/.claude/` and `.claude/` in the same session — never let a skill/command edit land in only one location.

## Best Practices

- Update documentation as you work, not in a final batch at the end of a session — a session that gets interrupted should still leave accurate state behind.
- When in doubt about whether something is "worth documenting," prefer documenting it — the cost of a slightly verbose `CHANGELOG.md` entry is much lower than the cost of the next session re-deriving the same finding.
- Cross-link related docs (e.g. a `CHANGELOG.md` entry can point to the `DECISIONS.md` entry it was based on).

## Common Mistakes

- Marking a module `Done` in `PROGRESS.md` without a corresponding `CHANGELOG.md` entry.
- Letting `CURRENT_CONTEXT.md` go stale across multiple sessions (it should never describe work from 3 sessions ago).
- Writing a `DECISIONS.md` entry with a decision but no alternatives/context, making it unreviewable later.
- Discovering a deviation from `../frontend/CLAUDE.md`/`CLAUDE.md` and fixing the code silently without noting it existed (loses the historical record of what was legacy vs. new).
- Adding a frontend-only or backend-only rule to the root `CLAUDE.md` instead of the repo-specific one (or vice versa for genuinely cross-cutting rules).

## Verification Checklist

- [ ] `CURRENT_CONTEXT.md` matches the actual state at session end
- [ ] Completed modules have a `CHANGELOG.md` entry and are reflected in `PROGRESS.md`/`COMPLETED_MODULES.md`
- [ ] New tradeoffs/open questions are in `DECISIONS.md` with context + alternatives
- [ ] New deviations are logged in `../.claude/context/KNOWN_ISSUES_AND_DEVIATIONS.md`
- [ ] Each rule lives in the right-scoped `CLAUDE.md` (root vs. frontend vs. backend)
