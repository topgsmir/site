FROM node:24.20.0-alpine
WORKDIR /usr/src/app
RUN corepack enable && corepack install --global pnpm@12.3.4
RUN chown node:node /usr/src/app
USER node
COPY --chown=node:node . .
RUN pnpm install --frozen-lockfile
RUN pnpm -C apps/api build
CMD ["pnpm", "-C", "apps/api", "start:prod"]
