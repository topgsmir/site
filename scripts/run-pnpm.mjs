import { spawnSync } from "node:child_process";
import { pnpmInvocation } from "./pnpm-invocation.mjs";

const pnpm = pnpmInvocation();
const result = spawnSync(pnpm.command, [...pnpm.args, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
  shell: pnpm.shell
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
