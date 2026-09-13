FROM node:24.20.0-alpine AS base
WORKDIR /usr/src/app
RUN corepack enable && corepack install --global pnpm@12.3.4
RUN chown node:node /usr/src/app
USER node
COPY --chown=node:node . .
RUN pnpm install --frozen-lockfile

FROM base AS development
ENV NODE_ENV=development
CMD ["pnpm", "-C", "apps/web", "dev", "--hostname", "0.0.0.0"]

FROM base AS production
ENV NODE_ENV=production
RUN pnpm -C apps/web build
CMD ["pnpm", "-C", "apps/web", "start"]
