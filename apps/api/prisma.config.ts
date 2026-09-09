import { config as loadEnvironment } from "dotenv";
import { defineConfig, env } from "prisma/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

loadEnvironment({
  path: [resolve(repositoryRoot, ".env"), resolve(repositoryRoot, ".env.local")],
  quiet: true
});

export default defineConfig({
  schema: "src/prisma/schema/schema.prisma",
  migrations: {
    path: "src/prisma/schema/migrations",
    seed: "tsx src/prisma/seed.ts"
  },
  datasource: {
    url: env("DATABASE_URL")
  }
});
