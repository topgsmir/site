FROM node:20-alpine
WORKDIR /usr/src/app
COPY . .
RUN npm install -g pnpm && pnpm install --no-frozen-lockfile
RUN pnpm -C apps/web build
CMD ["pnpm", "-C", "apps/web", "start"]

