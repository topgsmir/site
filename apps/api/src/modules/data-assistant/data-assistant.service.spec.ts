import assert from "node:assert/strict";
import test from "node:test";
import { DataAssistantService } from "./data-assistant.service";

type Execution = { id: string; name: string; kind: "tool" | "sql"; status: "proposed" | "running" | "completed" | "failed"; input: Record<string, unknown>; result: Record<string, unknown> | null; row_count: number | null; duration_ms: number | null; created_at: Date };

function harness(plans: Array<Record<string, unknown>>, initialExecutions: Execution[] = [], messageCount = 1) {
  const executions = [...initialExecutions];
  const runUpdates: Array<Record<string, unknown>> = [];
  const conversationUpdates: Array<Record<string, unknown>> = [];
  const events: Array<{ event: string; data: unknown }> = [];
  let outputMessage = 0;
  const run = { id: "run-1", conversation_id: "conversation-1", requester_id: "owner-1", profile_id: "profile-1", input_tokens: null as number | null, output_tokens: null as number | null, input_price_per_million_usd_snapshot: null, output_price_per_million_usd_snapshot: null };
  const transactionClient = {
    ai_messages: { create: async () => ({ id: "message-input" }) },
    ai_runs: { create: async () => ({ id: "run-1" }), update: async (args: { data: Record<string, unknown> }) => { runUpdates.push(args.data); Object.assign(run, args.data); return run; } },
    ai_audit_events: { create: async () => ({ id: "audit-start" }) },
    ai_conversations: { update: async (args: { data: Record<string, unknown> }) => { conversationUpdates.push(args.data); return { id: "conversation-1" }; } },
    ai_tool_executions: { create: async (args: { data: Omit<Execution, "id" | "created_at" | "result" | "row_count" | "duration_ms"> }) => { const item = { ...args.data, id: `execution-${executions.length + 1}`, created_at: new Date(), result: null, row_count: null, duration_ms: null } as Execution; executions.push(item); return item; } }
  };
  const prisma = {
    $transaction: async (operation: ((tx: typeof transactionClient) => Promise<unknown>) | unknown[]) => Array.isArray(operation) ? Promise.all(operation) : operation(transactionClient),
    ai_conversations: { findFirst: async () => ({ id: "conversation-1", _count: { messages: messageCount } }) },
    ai_messages: { findMany: async () => [], create: async () => ({ id: `message-output-${++outputMessage}` }) },
    ai_tool_executions: {
      findMany: async () => executions,
      create: transactionClient.ai_tool_executions.create,
      update: async (args: { where: { id: string }; data: Partial<Execution> }) => { const item = executions.find((candidate) => candidate.id === args.where.id)!; Object.assign(item, args.data); return item; }
    },
    ai_runs: {
      findUniqueOrThrow: async () => run,
      findUnique: async () => ({ conversation_id: "conversation-1" }),
      update: async (args: { data: Record<string, unknown> }) => { runUpdates.push(args.data); Object.assign(run, args.data); return run; }
    },
    ai_audit_events: { create: async () => ({ id: "audit" }) }
  };
  const profile = { id: "profile-1", provider: "openai", model_id: "gpt-test", base_url: "https://api.openai.com/v1", encrypted_api_key: "encrypted", encryption_key_id: "key-1", input_price_per_million_usd: null, output_price_per_million_usd: null };
  const models = {
    complete: async () => ({ text: JSON.stringify(plans.shift() ?? { mode: "answer" }), inputTokens: 5, outputTokens: 2, providerRequestId: null }),
    stream: async (_profile: unknown, _system: string, prompt: string, onText: (text: string) => void) => { assert.match(prompt, /seller_performance/); assert.match(prompt, /seller_products/); onText("Done"); return { text: "Done", inputTokens: 10, outputTokens: 2, providerRequestId: "request-1" }; }
  };
  const tools = { execute: async (name: string) => ({ rows: name === "seller_performance" ? [{ seller_id: "2eeda1d3-cdd1-4708-9903-70db7436ebdc", shop_name: "morteza" }] : [{ seller_id: "2eeda1d3-cdd1-4708-9903-70db7436ebdc", product_title: "Product" }], rowCount: 1, truncated: false, durationMs: 3 }) };
  const queries = { validate: (sql: string) => sql, execute: async () => ({ rows: [], rowCount: 0, truncated: false, durationMs: 1 }) };
  const service = new DataAssistantService(prisma as never, { activeById: async () => profile } as never, models as never, tools as never, queries as never);
  return { service, profile, executions, runUpdates, conversationUpdates, events, emit: (event: string, data: unknown) => events.push({ event, data }) };
}

test("uses multiple reporting tools before answering one message", async () => {
  const state = harness([
    { mode: "tool", tool: "seller_performance", input: {} },
    { mode: "tool", tool: "seller_products", input: { sellerId: "2eeda1d3-cdd1-4708-9903-70db7436ebdc" } },
    { mode: "answer" }
  ]);

  await state.service.ask("conversation-1", { profileId: "profile-1", question: "List the seller and some products" }, "owner-1", state.emit);

  assert.deepEqual(state.executions.filter((item) => item.name !== "continuation_checkpoint").map((item) => item.name), ["seller_performance", "seller_products"]);
  assert.equal(state.events.filter(({ event }) => event === "tool_result").length, 2);
  assert.ok(state.events.some(({ event }) => event === "completed"));
  assert.ok(state.runUpdates.some(({ status }) => status === "completed"));
  assert.equal(state.conversationUpdates[0]?.title, undefined);
});

test("derives a bounded conversation title from the first message without an extra model call", async () => {
  const state = harness([
    { mode: "tool", tool: "seller_performance", input: {} },
    { mode: "tool", tool: "seller_products", input: { sellerId: "2eeda1d3-cdd1-4708-9903-70db7436ebdc" } },
    { mode: "answer" }
  ], [], 0);

  await state.service.ask("conversation-1", { profileId: "profile-1", question: "  فروش ماهانه   فروشندگان را با ماه قبل مقایسه کن و نتیجه را توضیح بده  " }, "owner-1", state.emit);

  assert.equal(state.conversationUpdates[0]?.title, "فروش ماهانه فروشندگان را با ماه قبل مقایسه…");
});

test("requires admin continuation approval after each ten completed tool calls", async () => {
  const completed = Array.from({ length: 10 }, (_, index): Execution => ({ id: `execution-${index}`, name: `tool-${index}`, kind: "tool", status: "completed", input: { days: index + 1 }, result: { rows: [], rowCount: 0, truncated: false, durationMs: 1 }, row_count: 0, duration_ms: 1, created_at: new Date(index) }));
  const state = harness([], completed);

  await (state.service as unknown as { runLoop(runId: string, profile: unknown, question: string, history: unknown[], ownerId: string, started: number, emit: (event: string, data: unknown) => void): Promise<void> }).runLoop("run-1", state.profile, "question", [], "owner-1", Date.now(), state.emit);

  const checkpoint = state.executions.find((item) => item.name === "continuation_checkpoint");
  assert.equal(checkpoint?.status, "proposed");
  assert.deepEqual(checkpoint?.input, { toolCallCount: 10 });
  assert.ok(state.runUpdates.some(({ status }) => status === "awaiting_approval"));
  assert.ok(state.events.some(({ event }) => event === "continuation_approval_required"));
});
