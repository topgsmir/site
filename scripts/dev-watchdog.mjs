import { spawn } from "node:child_process";

const processGroupId = Number(process.argv[2]);

if (!Number.isSafeInteger(processGroupId) || processGroupId <= 0) {
  process.exit(1);
}

let cleaningUp = false;

function cleanUpProcessTree() {
  if (cleaningUp) {
    return;
  }

  cleaningUp = true;

  if (process.platform !== "win32") {
    try {
      process.kill(-processGroupId, "SIGTERM");
    } catch (error) {
      if (error.code !== "ESRCH") {
        process.exitCode = 1;
      }
    }
    return;
  }

  const killer = spawn(
    "taskkill.exe",
    ["/pid", String(processGroupId), "/T", "/F"],
    { stdio: "ignore", windowsHide: true }
  );
  killer.on("error", () => {
    process.exitCode = 1;
  });
}

process.stdin.resume();
process.stdin.once("end", cleanUpProcessTree);
process.stdin.once("close", cleanUpProcessTree);
process.stdin.once("error", cleanUpProcessTree);
