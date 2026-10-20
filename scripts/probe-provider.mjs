import { spawn } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { codexCommand } from "../server/codex-command.ts";
const cwd = await mkdtemp(join(tmpdir(), "tablesignal-probe-"));
const args = [
  "exec",
  "--ignore-user-config",
  "--skip-git-repo-check",
  "--ephemeral",
  "--sandbox",
  "read-only",
  "--json",
  "-c",
  'web_search="live"',
  "--disable",
  "shell_tool",
  "--disable",
  "apps",
  "--disable",
  "plugins",
  "--disable",
  "hooks",
  "--disable",
  "multi_agent",
  "--disable",
  "computer_use",
  "--disable",
  "browser_use",
  "--disable",
  "image_generation",
  "--disable",
  "view_image",
  "-c",
  "features.skip_host_skill_discovery=true",
  "-c",
  "project_doc_max_bytes=0",
  "-",
];
const command = codexCommand(args);
const child = spawn(command.executable, command.args, {
  cwd,
  stdio: ["pipe", "pipe", "pipe"],
  windowsHide: true,
  env: process.env,
});
let output = "",
  errors = "";
child.stdout.on("data", (d) => (output += d));
child.stderr.on("data", (d) => (errors += d));
child.stdin.end(
  "Use live web search to answer this dining question independently. Do not use local files, shell commands, other apps, or external actions. Recommend at most three restaurants in a numbered list with bold names and actual source URLs, using current public evidence. Do not force any particular restaurant into the answer. Question: Where can I get a sit-down pizza dinner in Greenwich Village, New York City?",
);
const timer = setTimeout(() => child.kill("SIGTERM"), 150000);
child.on("close", async (code) => {
  clearTimeout(timer);
  await writeFile("data/provider-probe.jsonl", output);
  await writeFile("data/provider-probe-stderr.log", errors);
  let events = output
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return { type: "unparsed" };
      }
    });
  console.log(
    JSON.stringify(
      {
        code,
        eventTypes: events.map((e) => e.type),
        items: events.filter(
          (e) =>
            e.item?.type === "agent_message" ||
            e.type === "error" ||
            e.type === "turn.failed",
        ),
        usage: events.find((e) => e.type === "turn.completed")?.usage,
        stderr: errors.slice(-600),
      },
      null,
      2,
    ),
  );
});
