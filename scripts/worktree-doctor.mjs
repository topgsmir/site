import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync
} from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pnpmInvocation } from "./pnpm-invocation.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const expectedPnpm = manifest.packageManager.match(/^pnpm@(.+)$/)?.[1];
const expectedNode = manifest.engines.node;
const failures = [];

check("Node version", () => {
  assert(process.versions.node === expectedNode, `expected Node ${expectedNode}, found ${process.version}`);
  return process.version;
});

check("pnpm version", () => {
  const actual = pnpmVersion();
  assert(actual === expectedPnpm, `expected pnpm ${expectedPnpm}, found ${actual || "none"}`);
  return actual;
});

check("Git merge state", () => {
  const unresolved = command("git", ["ls-files", "-u"]).stdout.trim();
  const paths = [...new Set(
    unresolved
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => line.slice(line.indexOf("\t") + 1))
  )];
  assert(!paths.length, `unresolved merge paths: ${paths.join(", ")}`);
  return "clean";
});

check("Lockfile integrity", () => {
  const lockfile = resolve(root, "pnpm-lock.yaml");
  assert(existsSync(lockfile), "pnpm-lock.yaml is missing");
  command("git", ["ls-files", "--error-unmatch", "pnpm-lock.yaml"]);

  const bootstrapHash = process.env.TOPGSM_BOOTSTRAP_LOCKFILE_SHA256;
  if (bootstrapHash) {
    assert(sha256(lockfile) === bootstrapHash, "pnpm-lock.yaml changed during bootstrap");
  } else {
    const status = command("git", [
      "status",
      "--porcelain=v1",
      "--untracked-files=no",
      "--",
      "pnpm-lock.yaml"
    ]).stdout.trim();
    assert(!status, "pnpm-lock.yaml has uncommitted changes");
  }
  return "tracked and unchanged";
});

check("pnpm workspace links", () => {
  const metadataPath = resolve(root, "node_modules/.modules.yaml");
  assert(existsSync(metadataPath), "node_modules metadata is missing");
  const metadata = readFileSync(metadataPath, "utf8");
  const parsedMetadata = parseModulesMetadata(metadata);
  const installer = parsedMetadata.packageManager;
  const storeDir = parsedMetadata.storeDir;
  assert(installer === `pnpm@${expectedPnpm}`, `node_modules was linked by ${installer || "an unknown pnpm version"}`);
  assert(storeDir && isAbsolute(storeDir), "pnpm shared store path is missing");
  const storeRelative = relative(root, resolve(storeDir));
  assert(storeRelative.startsWith("..") || isAbsolute(storeRelative), "pnpm store must live outside the worktree");

  const sharedTypesLink = resolve(root, "apps/api/node_modules/@topgsm/shared-types");
  assert(existsSync(sharedTypesLink), "API shared-types workspace link is missing");
  assert(lstatSync(sharedTypesLink).isSymbolicLink(), "API shared-types dependency is not a link");
  assert(
    realpathSync(sharedTypesLink) === realpathSync(resolve(root, "packages/shared-types")),
    "API shared-types link targets the wrong worktree"
  );
  return storeDir;
});

check("API TypeScript", () => typescriptVersion("topgsm-api"));
check("Web TypeScript", () => typescriptVersion("topgsm-web"));

check("Prisma client", () => {
  const schemaPath = resolve(root, "apps/api/src/prisma/schema/schema.prisma");
  const generatedClient = resolve(root, "apps/api/src/generated/prisma/client.ts");
  const generatedStamp = resolve(root, "apps/api/src/generated/prisma/.schema.sha256");
  assert(existsSync(generatedClient), "generated Prisma client is missing");
  assert(existsSync(generatedStamp), "generated Prisma schema stamp is missing");
  assert(
    normalizedSha256(schemaPath) === readFileSync(generatedStamp, "utf8").trim(),
    "generated Prisma client is stale"
  );
  return "generated client matches schema.prisma";
});

check("Environment-file safety", () => {
  const examplePath = resolve(root, ".env.example");
  assert(existsSync(examplePath), ".env.example is missing");
  const names = new Set(
    readFileSync(examplePath, "utf8")
      .split(/\r?\n/)
      .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
      .map((line) => line.slice(0, line.indexOf("=")))
  );
  for (const name of ["NODE_ENV", "DATABASE_URL", "API_PORT", "WEB_ORIGIN", "NEXT_PUBLIC_API_URL"]) {
    assert(names.has(name), `.env.example does not document ${name}`);
  }
  command("git", ["check-ignore", "--quiet", ".env"]);
  const tracked = command("git", ["ls-files"]).stdout
    .split(/\r?\n/)
    .filter((path) => /(^|\/)\.env(?:\.|$)/.test(path) && !path.endsWith(".env.example"));
  assert(!tracked.length, "a runtime environment file is tracked by Git");
  return ".env.example present; runtime .env files ignored";
});

if (failures.length) {
  console.error(`\nDoctor found ${failures.length} problem${failures.length === 1 ? "" : "s"}:`);
  for (const failure of failures) console.error(`- ${failure.label}: ${failure.message}`);
  console.error(`\nRemediation: activate Node ${expectedNode}, then run corepack enable && corepack install --global pnpm@${expectedPnpm} && pnpm bootstrap`);
  process.exit(1);
}

console.log("\nWorktree is ready.");

function check(label, action) {
  try {
    const detail = action();
    console.log(`PASS ${label}${detail ? `: ${detail}` : ""}`);
  } catch (error) {
    failures.push({ label, message: error instanceof Error ? error.message : String(error) });
    console.error(`FAIL ${label}`);
  }
}

function typescriptVersion(packageName) {
  const result = pnpmCommand(["--filter", packageName, "exec", "tsc", "--version"]);
  return result.stdout.trim();
}

function pnpmVersion() {
  const fromUserAgent = process.env.npm_config_user_agent?.match(/^pnpm\/([^\s]+)/)?.[1];
  if (fromUserAgent) return fromUserAgent;
  return pnpmCommand(["--version"]).stdout.trim();
}

function pnpmCommand(args) {
  const pnpm = pnpmInvocation();
  return command(pnpm.command, [...pnpm.args, ...args], pnpm.shell);
}

function command(executable, args, shell = false) {
  const result = spawnSync(executable, args, {
    cwd: root,
    encoding: "utf8",
    shell
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `${executable} exited ${result.status}`).trim());
  }
  return result;
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function normalizedSha256(path) {
  const normalized = readFileSync(path, "utf8").replace(/\r\n/g, "\n").trim();
  return createHash("sha256").update(normalized).digest("hex");
}

function parseModulesMetadata(contents) {
  try {
    return JSON.parse(contents);
  } catch {
    return {
      packageManager: contents.match(/^packageManager:\s*(.+)$/m)?.[1]?.trim(),
      storeDir: contents.match(/^storeDir:\s*(.+)$/m)?.[1]?.trim()
    };
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
