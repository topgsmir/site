export function pnpmInvocation() {
  const packageManagerExecutable = process.env.npm_execpath;

  if (packageManagerExecutable?.toLowerCase().includes("pnpm")) {
    if (/\.(?:cjs|mjs|js)$/i.test(packageManagerExecutable)) {
      return {
        command: process.execPath,
        args: [packageManagerExecutable],
        shell: false
      };
    }

    return {
      command: packageManagerExecutable,
      args: [],
      shell: process.platform === "win32" && /\.(?:cmd|bat)$/i.test(packageManagerExecutable)
    };
  }

  return {
    command: process.platform === "win32" ? "corepack.cmd" : "corepack",
    args: ["pnpm"],
    shell: process.platform === "win32"
  };
}
