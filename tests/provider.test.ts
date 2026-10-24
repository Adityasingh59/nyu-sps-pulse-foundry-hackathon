import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { codexCommand } from "../server/codex-command.ts";
import { providerInfo } from "../server/providers.ts";
import {
  codexBinary,
  parseCodexEvents,
  sanitizeCitations,
} from "../server/codex-provider.ts";
const stream = (...events: unknown[]) =>
  events.map((e) => JSON.stringify(e)).join("\n");
test(
  "cloud configuration refuses to fall back to a local CLI sign-in",
  { skip: Boolean(process.env.OPENAI_API_KEY) },
  () => {
    const prior = process.env.TABLESIGNAL_DISABLE_CODEX;
    try {
      process.env.TABLESIGNAL_DISABLE_CODEX = "true";
      const provider = providerInfo();
      assert.equal(provider.configured, false);
      assert.equal(provider.adapter, "openai");
      assert.match(provider.status, /website collection is available/);
    } finally {
      if (prior === undefined) delete process.env.TABLESIGNAL_DISABLE_CODEX;
      else process.env.TABLESIGNAL_DISABLE_CODEX = prior;
    }
  },
);
test("local CLI command uses Node and the installed JavaScript entry point", () => {
  const args = ["login", "status"];
  const command = codexCommand(args, { executableOverride: "" });
  assert.equal(command.executable, process.execPath);
  assert.equal(command.args[0], command.installedPath);
  assert.match(
    command.installedPath,
    /node_modules[/\\]@openai[/\\]codex[/\\]bin[/\\]codex\.js$/,
  );
  assert.deepEqual(command.args.slice(1), args);
});
test("CLI launcher preserves spaced paths and arguments without a shell", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tablesignal CLI fixture "));
  try {
    const launcherPath = join(directory, "fake CLI launcher.mjs");
    await writeFile(
      launcherPath,
      "process.stdout.write(JSON.stringify(process.argv.slice(2)));\n",
    );
    const args = [
      "--output-schema",
      join(directory, "answer schema.json"),
      "a;b",
    ];
    const command = codexCommand(args, {
      executableOverride: "",
      launcherPath,
    });
    const result = spawnSync(command.executable, command.args, {
      cwd: tmpdir(),
      encoding: "utf8",
      timeout: 5000,
      windowsHide: true,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), args);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test("custom CLI executable remains a direct executable override", () => {
  const executable = join(tmpdir(), "custom tools", "codex.exe");
  const args = ["exec", "--json", "-"];
  const previous = process.env.TABLESIGNAL_CODEX_PATH;
  try {
    process.env.TABLESIGNAL_CODEX_PATH = executable;
    assert.equal(codexBinary(), executable);
    assert.deepEqual(codexCommand(args), {
      executable,
      args,
      installedPath: executable,
    });
  } finally {
    if (previous === undefined) delete process.env.TABLESIGNAL_CODEX_PATH;
    else process.env.TABLESIGNAL_CODEX_PATH = previous;
  }
});
test("live CLI adapter requires completed turns and recorded web retrieval", () => {
  assert.throws(
    () => parseCodexEvents(stream({ type: "turn.failed" })),
    /did not complete/,
  );
  assert.throws(
    () =>
      parseCodexEvents(
        stream(
          {
            type: "item.completed",
            item: { type: "agent_message", text: "A remembered answer." },
          },
          { type: "turn.completed" },
        ),
      ),
    /no recorded web-search/,
  );
});
test("live CLI capture preserves the final answer, actual citations and usage without intermediate reasoning", () => {
  const answer = "1. **Example Pizza** — Current pizza option.";
  const result = parseCodexEvents(
    stream(
      { type: "thread.started", thread_id: "independent-session" },
      {
        type: "item.completed",
        item: { type: "agent_message", text: "Searching now" },
      },
      {
        type: "item.completed",
        item: {
          type: "web_search",
          query: "pizza near NYU",
          results: [{ url: "https://unused.example/" }],
        },
      },
      {
        type: "item.completed",
        item: { type: "reasoning", text: "not part of the public answer" },
      },
      {
        type: "item.completed",
        item: {
          type: "agent_message",
          text: JSON.stringify({
            answer,
            citations: [
              { title: "Official menu", url: "https://pizza.example/menu" },
            ],
          }),
        },
      },
      {
        type: "turn.completed",
        usage: { input_tokens: 100, output_tokens: 50 },
      },
    ),
  );
  assert.equal(result.rawAnswer, answer);
  assert.deepEqual(result.citations, [
    { title: "Official menu", url: "https://pizza.example/menu" },
  ]);
  assert.ok(
    !JSON.stringify(result.rawResponse).includes(
      "not part of the public answer",
    ),
  );
  assert.ok(JSON.stringify(result.rawResponse).includes("input_tokens"));
});
test("provider citation filtering rejects scripts, credentials and duplicate links", () => {
  assert.deepEqual(
    sanitizeCitations([
      { url: "javascript:alert(1)" },
      { url: "https://user:pass@example.org" },
      { url: "https://example.org/menu", title: "Menu" },
      { url: "https://example.org/menu", title: "Again" },
    ]),
    [{ url: "https://example.org/menu", title: "Menu" }],
  );
});
