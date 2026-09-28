# Repository agent instructions

## Worktree bootstrap

- The repository requires Node 24.20.0 and pnpm 12.3.4 exactly.
- Run `pnpm run doctor` before coding. If it fails, follow its remediation line;
  normally this is `pnpm bootstrap` after activating the pinned tools.
- Never copy `node_modules` between worktrees. Use `pnpm bootstrap` so pnpm
  creates worktree-local links backed by its shared content store.
- Prisma generation is part of `postinstall`; do not start API checks with a
  stale or missing client.
- Use `pnpm worktree:sync` only from a clean feature worktree when it needs the
  latest `origin/main`.

Report security defects and meaningful best-practice problems discovered while
working, even when they are outside the immediate change.

## Compact feature design

- For every UI feature, redesign, or review, read
  [the compact UI guidelines](.agents/skills/hallmark/references/topgsm-compact-ui.md).
- Default to compact, task-focused layouts: show the primary action, essential
  controls, and useful content in the first laptop viewport. Reduce unnecessary
  scrolling through layout and progressive disclosure, while preserving readable
  text, accessible controls, and all required information.
- These project defaults override generic skill advice about oversized heroes,
  display typography, generous whitespace, and page-to-page layout variation.
  A more spacious treatment requires a clear need in the user's brief.

## Admin AI tool parity

- Follow `.cursor/rules/ai-tool-parity.mdc` for every feature or API change.
- Keep ordinary admin/site controller routes represented in
  `apps/api/src/modules/data-assistant/admin-tool-catalog.ts`.
- Run the catalog controller-coverage test; security-flow exclusions must be
  explicit and justified rather than silently omitted.
