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
