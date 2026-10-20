import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCodexEvents,
  sanitizeCitations,
} from "../server/codex-provider.ts";
const stream = (...events: unknown[]) =>
  events.map((e) => JSON.stringify(e)).join("\n");
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
