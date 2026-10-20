import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (Number(process.versions.node.split(".")[0]) < 24) {
  console.error("TableSignal requires Node.js 24 or newer. Install it, then run npm ci.");
  process.exit(1);
}
const npm = process.env.npm_execpath;
if (!npm) {
  console.error("Run this command with npm run setup after npm ci.");
  process.exit(1);
}
for (const args of [[npm, "run", "build"], [resolve(root, "scripts/local.mjs"), "up"]]) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit" });
  if (result.error || result.status !== 0) {
    console.error("Setup stopped. Fix the error above and run npm run setup again.");
    process.exit(result.status || 1);
  }
}
