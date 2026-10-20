import { fileURLToPath } from "node:url";

// @openai/codex declares this JavaScript entry point in package.json. Running
// it with Node avoids npm's platform-specific .bin shims and shell quoting.
const launcherPath = fileURLToPath(
  new URL("../node_modules/@openai/codex/bin/codex.js", import.meta.url),
);

export function codexCommand(
  args: readonly string[],
  options: { executableOverride?: string; launcherPath?: string } = {},
) {
  const override =
    options.executableOverride ?? process.env.TABLESIGNAL_CODEX_PATH;
  const launcher = options.launcherPath ?? launcherPath;
  return override
    ? { executable: override, args: [...args], installedPath: override }
    : {
        executable: process.execPath,
        args: [launcher, ...args],
        installedPath: launcher,
      };
}
