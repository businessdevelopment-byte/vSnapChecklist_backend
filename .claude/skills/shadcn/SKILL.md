---
name: shadcn
description: Use and extend ../frontend/'s actual shadcn/ui setup (new-york style, 26 components, custom button sizes) instead of assuming stock defaults.
---

## Purpose

Reuse the existing shadcn/ui setup correctly, including its project-specific customizations, rather than reintroducing stock defaults or a competing UI approach.

## When to Use

- Building any UI for a new or migrated feature in `../frontend/`.
- Deciding whether to add a new shadcn component via the CLI.

## Rules

- Config: `new-york` style, `neutral` base color, CSS variables on, `lucide` icons, no `tailwind.config.js` path (v4 CSS-first) — see `../frontend/components.json`.
- 26 components already exist in `../frontend/src/components/ui/` — check there before running the shadcn CLI to add a new one.
- This project uses the consolidated `radix-ui` meta-package, not individual `@radix-ui/react-*` packages — match that import style if adding new Radix-based primitives by hand.
- `button.tsx` has custom sizes beyond stock shadcn (`xs`, `icon-xs`, `icon-sm`, `icon-lg`) for dense admin UI — use these instead of adding a new ad hoc size.
- No TanStack Table is installed — tables are hand-built with the stock `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell` primitives.

## Best Practices

- Given the very repetitive Pending/History table shape across the migration targets (OTP/PMS/Political all need near-identical tables), consider proposing one shared `DataTable`-style component once you've built 2+ of these tables by hand — don't build it speculatively before that need is proven, and log the decision in `../docs/migration/DECISIONS.md`.
- Reuse Tailwind v4 design tokens (`--primary`, `--sidebar-*`, `--chart-1..5`, OKLCH-based) defined in `../frontend/src/app/globals.css` instead of hardcoding colors.
- Use `Dialog`/`Sheet` for modals/drawers to match the existing pattern, not a hand-rolled overlay.

## Common Mistakes

- Adding a new UI library (e.g. Ant Design, MUI) instead of extending shadcn/ui.
- Reinstalling individual `@radix-ui/react-*` packages when `radix-ui` already provides them.
- Copying `Master`'s hand-rolled Tailwind divs (most of its "UI kit" isn't actually using its installed Radix dependencies) instead of using `frontend`'s real shadcn primitives.

## Verification Checklist

- [ ] No new UI library introduced
- [ ] Existing `components/ui/` primitives reused where possible
- [ ] New Radix-based primitives use the `radix-ui` meta-package import style
- [ ] Colors come from existing design tokens, not hardcoded values
