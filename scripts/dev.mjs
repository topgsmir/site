import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { pnpmInvocation } from "./pnpm-invocation.mjs";

const isWindows = process.platform === "win32";
const pnpm = pnpmInvocation();
const services = ["topgsm-api", "topgsm-web"];
const children = new Set();
const serviceByChild = new Map();
const watchdogs = new Map();
let shuttingDown = false;
const watchdogScript = fileURLToPath(new URL("./dev-watchdog.mjs", import.meta.url));
const startedAt = Date.now();
const stamp = new Intl.DateTimeFormat("en-GB", {
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  fractionalSecondDigits: 3
});

function log(message) {
  console.log(`[dev ${stamp.format(new Date())}] ${message}`);
}

function logChildOutput(child, service) {
  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");

  child.stdout?.on("data", (chunk) => {
    chunk.toString().split("\n").forEach((line) => {
      if (line.trim().length > 0) {
        log(`[${service}] ${line.trimEnd()}`);
      }
    });
  });

  child.stderr?.on("data", (chunk) => {
    chunk.toString().split("\n").forEach((line) => {
      if (line.trim().length > 0) {
        log(`[${service}] ${line.trimEnd()}`);
      }
    });
  });
}

function startService(service) {
  log(`Starting service "${service}"`);
  const args = [...pnpm.args, "--filter", service, "run", "dev"];
  log(`Using command: ${pnpm.command} ${args.join(" ")}`);
  const child = spawn(pnpm.command, args, {
    stdio: ["pipe", "pipe", "pipe"],
    shell: pnpm.shell,
    detached: !isWindows
  });
  logChildOutput(child, service);
  serviceByChild.set(child, { service, startedAt: Date.now(), pid: null });

  children.add(child);

  child.once("spawn", () => {
    const info = serviceByChild.get(child);
    if (info) {
      info.pid = child.pid ?? null;
    }
    log(`Service "${service}" spawn event received (pid=${child.pid})`);
    const watchdog = spawn(process.execPath, [watchdogScript, String(child.pid)], {
      stdio: ["pipe", "ignore", "ignore"],
      detached: true,
      windowsHide: true
    });
    watchdog.unref();
    watchdogs.set(child, watchdog);
    log(`Watchdog started for "${service}" (pid=${watchdog.pid})`);
  });

  child.on("error", (error) => {
    log(`Failed to start "${service}"`);
    console.error(`[dev] Failed to start ${service}:`, error);
    void shutdown(1);
  });

  child.on("exit", (code, signal) => {
    children.delete(child);
    serviceByChild.delete(child);
    watchdogs.get(child)?.stdin?.end();
    watchdogs.delete(child);

    if (!shuttingDown) {
      const reason = signal ? `signal ${signal}` : `exit code ${code ?? 1}`;
      log(`Service "${service}" stopped with ${reason}; shutting down all services`);
      console.error(`[dev] ${service} stopped with ${reason}; stopping all services.`);
      void shutdown(code ?? 1);
    }
  });
}

function emitServiceStatus() {
  const running = [...serviceByChild.entries()].map(([child, info]) => {
    const name = info.service;
    const pid = info.pid ? String(info.pid) : "starting";
    const ageMs = Date.now() - info.startedAt;
    return `${name}(pid=${pid}, age=${Math.round(ageMs / 1000)}s)`;
  });
  if (running.length) {
    log(`Status heartbeat — live service runners: ${running.join(", ")}`);
  } else {
    log("Status heartbeat — no live service runners yet");
  }
}

const statusTimer = setInterval(emitServiceStatus, 5000);

function killProcessTree(child) {
  log(`Stopping pid=${child.pid}`);
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
  clearInterval(statusTimer);
  emitServiceStatus();
  log(`Shutdown requested (exitCode=${exitCode}); terminating ${children.size} service(s)`);
  await Promise.all([...children].map(killProcessTree));
  process.exit(exitCode);
}

process.on("SIGINT", () => void shutdown(130));
process.on("SIGTERM", () => void shutdown(143));
process.on("SIGHUP", () => void shutdown(129));

log("Starting TopGSM development orchestrator");
log(`Services to start: ${services.join(", ")}`);
log(`Environment check: NODE_ENV=${process.env.NODE_ENV || "not-set"}, DATABASE_URL=${process.env.DATABASE_URL ? "set" : "not-set"}`);
for (const service of services) {
  startService(service);
}
log("All services were handed to the process manager");

setImmediate(() => {
  log("Dev runner is now active. If a service has no startup output yet, status heartbeats will print every 5 seconds.");
});
