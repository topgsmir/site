import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const isWindows = process.platform === "win32";
const packageManagerScript = process.env.npm_execpath;
const pnpmCommand = packageManagerScript ? process.execPath : isWindows ? "pnpm.cmd" : "pnpm";
const pnpmArguments = packageManagerScript ? [packageManagerScript] : [];
const services = ["topgsm-api", "topgsm-web"];
const children = new Set();
const watchdogs = new Map();
let shuttingDown = false;
const watchdogScript = fileURLToPath(new URL("./dev-watchdog.mjs", import.meta.url));

function startService(service) {
  const child = spawn(pnpmCommand, [...pnpmArguments, "--filter", service, "run", "dev"], {
    stdio: "inherit",
    shell: isWindows && !packageManagerScript,
    detached: !isWindows
  });

  children.add(child);

  child.once("spawn", () => {
    const watchdog = spawn(process.execPath, [watchdogScript, String(child.pid)], {
      stdio: ["pipe", "ignore", "ignore"],
      detached: true,
      windowsHide: true
    });
    watchdog.unref();
    watchdogs.set(child, watchdog);
  });

  child.on("error", (error) => {
    console.error(`[dev] Failed to start ${service}:`, error);
    void shutdown(1);
  });

  child.on("exit", (code, signal) => {
    children.delete(child);
    watchdogs.get(child)?.stdin?.end();
    watchdogs.delete(child);

    if (!shuttingDown) {
      const reason = signal ? `signal ${signal}` : `exit code ${code ?? 1}`;
      console.error(`[dev] ${service} stopped with ${reason}; stopping all services.`);
      void shutdown(code ?? 1);
    }
  });
}

function killProcessTree(child) {
  if (!child.pid) {
    return Promise.resolve();
  }

  if (!isWindows) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch (error) {
      if (error.code !== "ESRCH") {
        console.error(`[dev] Failed to stop process group ${child.pid}:`, error);
      }
    }
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const killer = spawn(
      "taskkill.exe",
      ["/pid", String(child.pid), "/T", "/F"],
      { stdio: "ignore", windowsHide: true }
    );
    killer.on("error", resolve);
    killer.on("exit", resolve);
  });
}

async function shutdown(exitCode) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  await Promise.all([...children].map(killProcessTree));
  process.exit(exitCode);
}

process.on("SIGINT", () => void shutdown(130));
process.on("SIGTERM", () => void shutdown(143));
process.on("SIGHUP", () => void shutdown(129));

for (const service of services) {
  startService(service);
}
