FROM node:24.20.0-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential ca-certificates git python3 \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable \
    && corepack install --global pnpm@12.3.4 \
    && pnpm --version

ENV CI=true

WORKDIR /tmp/topgsm-pnpm-cache
COPY --chown=node:node pnpm-lock.yaml pnpm-workspace.yaml ./

USER node

# Warm the shared content store without baking branch-specific source into the
# image. Each worktree still creates its own lightweight dependency links.
RUN pnpm fetch --frozen-lockfile
