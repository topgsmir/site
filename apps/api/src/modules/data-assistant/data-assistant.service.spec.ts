import assert from "node:assert/strict";
import test from "node:test";
import { DataAssistantService } from "./data-assistant.service";

type Execution = { id: string; run_id: string; name: string; kind: "tool" | "sql"; status: "proposed" | "running" | "completed" | "failed" | "rejected"; input: Record<string, unknown>; result: Record<string, unknown> | null; row_count: number | null; duration_ms: number | null; approved_by_id?: string | null; approved_at?: Date | null; completed_at?: Date | null; sql_text?: string | null; sql_hash?: string | null; created_at: Date };

function harness(plans: Array<Record<string, unknown>>, initialExecutions: Execution[] = [], messageCount = 1, withAdminTools = false) {
  const executions = [...initialExecutions];
  const runUpdates: Array<Record<string, unknown>> = [];
  const conversationUpdates: Array<Record<string, unknown>> = [];
  const events: Array<{ event: string; data: unknown }> = [];
  let outputMessage = 0;
  const run = { id: "run-1", conversation_id: "conversation-1", requester_id: "owner-1", profile_id: "profile-1", status: "running", started_at: new Date(), input_tokens: null as number | null, output_tokens: null as number | null, input_price_per_million_usd_snapshot: null, output_price_per_million_usd_snapshot: null };
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
      findFirst: async (args: { where: { id: string; status: string } }) => { const item = executions.find((candidate) => candidate.id === args.where.id && candidate.status === args.where.status); return item ? { ...item, run: { ...run, profile, input_message: { content: "Show user user-1" } } } : null; },
      create: transactionClient.ai_tool_executions.create,
      update: async (args: { where: { id: string }; data: Partial<Execution> }) => { const item = executions.find((candidate) => candidate.id === args.where.id)!; Object.assign(item, args.data); return item; },
      updateMany: async (args: { where: { id: string; status: string }; data: Partial<Execution> }) => { const item = executions.find((candidate) => candidate.id === args.where.id && candidate.status === args.where.status); if (!item) return { count: 0 }; Object.assign(item, args.data); return { count: 1 }; }
    },
    ai_runs: {
      findFirst: async () => null,
      findUniqueOrThrow: async () => run,
      findUnique: async () => ({ conversation_id: "conversation-1" }),
      update: async (args: { data: Record<string, unknown> }) => { runUpdates.push(args.data); Object.assign(run, args.data); return run; }
    },
    ai_audit_events: { create: async () => ({ id: "audit" }) }
  };
  const profile = { id: "profile-1", provider: "openai", model_id: "gpt-test", base_url: "https://api.openai.com/v1", encrypted_api_key: "encrypted", encryption_key_id: "key-1", input_price_per_million_usd: null, output_price_per_million_usd: null };
  const models = {
    complete: async () => ({ text: JSON.stringify(plans.shift() ?? { mode: "answer" }), inputTokens: 5, outputTokens: 2, providerRequestId: null }),
    stream: async (_profile: unknown, _system: string, prompt: string, onText: (text: string) => void) => { if (prompt.includes("seller_performance")) { assert.match(prompt, /seller_performance/); assert.match(prompt, /seller_products/); } onText("Done"); return { text: "Done", inputTokens: 10, outputTokens: 2, providerRequestId: "request-1" }; }
  };
  const tools = { execute: async (name: string) => ({ rows: name === "seller_performance" ? [{ seller_id: "2eeda1d3-cdd1-4708-9903-70db7436ebdc", shop_name: "morteza" }] : [{ seller_id: "2eeda1d3-cdd1-4708-9903-70db7436ebdc", product_title: "Product" }], rowCount: 1, truncated: false, durationMs: 3 }) };
  const queries = { validate: (sql: string) => sql, execute: async () => ({ rows: [], rowCount: 0, truncated: false, durationMs: 1 }) };
  const adminTools = {
    compactPrompt: () => withAdminTools ? "- admin_user_get [read] GET /admin/users/:id" : "",
    list: () => [],
    capabilitySummary: () => withAdminTools ? [{ domain: "users", toolCount: 1, read: 1, write: 0, destructive: 0, critical: 0, examples: [{ name: "admin_user_get", description: "Read a user" }] }] : [],
    search: (query: string) => withAdminTools ? [{ name: "admin_user_get", domain: "users", method: "GET", path: "/admin/users/:id", risk: "read", description: `Match for ${query}`, inputHint: "path: id", requiresApproval: true }] : [],
    has: (name: string) => withAdminTools && name === "admin_user_get",
    prepare: (name: string, input: unknown) => ({ name, domain: "users", method: "GET", path: `/admin/users/${(input as { path: { id: string } }).path.id}`, query: {}, risk: "read", description: "Read a user" }),
    sanitizeResult: (value: unknown) => ({ value, truncated: false })
  };
  const service = new DataAssistantService(prisma as never, { activeById: async () => profile } as never, models as never, tools as never, queries as never, adminTools as never);
  return { service, models, profile, executions, runUpdates, conversationUpdates, events, emit: (event: string, data: unknown) => events.push({ event, data }) };
}

test("persists and emits a safe timeout category after successful discovery", async () => {
  const state = harness([{ mode: "discover", query: "inspect user" }], [], 1, true);
  const complete = state.models.complete;
  let calls = 0;
  state.models.complete = async () => {
    if (calls++ > 0) throw new Error("private provider response", { cause: new DOMException("secret", "TimeoutError") });
    return complete();
  };
  await state.service.ask("conversation-1", { profileId: "profile-1", question: "Inspect users" }, "owner-1", state.emit);
  assert.equal(state.executions[0].status, "completed");
  assert.ok(state.runUpdates.some((update) => update.error_code === "AI_TIMEOUT"));
  assert.deepEqual(state.events.find(({ event }) => event === "failed")?.data, { runId: "run-1", code: "AI_TIMEOUT", statusCode: null });
  assert.doesNotMatch(JSON.stringify(state.events), /secret|private provider response/);
});

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
  const completed = Array.from({ length: 10 }, (_, index): Execution => ({ id: `execution-${index}`, run_id: "run-1", name: `tool-${index}`, kind: "tool", status: "completed", input: { days: index + 1 }, result: { rows: [], rowCount: 0, truncated: false, durationMs: 1 }, row_count: 0, duration_ms: 1, created_at: new Date(index) }));
  const state = harness([], completed);

  await (state.service as unknown as { runLoop(runId: string, profile: unknown, question: string, history: unknown[], ownerId: string, started: number, emit: (event: string, data: unknown) => void): Promise<void> }).runLoop("run-1", state.profile, "question", [], "owner-1", Date.now(), state.emit);

  const checkpoint = state.executions.find((item) => item.name === "continuation_checkpoint");
  assert.equal(checkpoint?.status, "proposed");
  assert.deepEqual(checkpoint?.input, { toolCallCount: 10 });
  assert.ok(state.runUpdates.some(({ status }) => status === "awaiting_approval"));
  assert.ok(state.events.some(({ event }) => event === "continuation_approval_required"));
});

test("proposes an allowlisted admin API tool and pauses for owner approval", async () => {
  const state = harness([
    { mode: "api", tool: "admin_user_get", purpose: "Inspect the requested user", input: { path: { id: "user-1" } } }
  ], [], 1, true);

  await state.service.ask("conversation-1", { profileId: "profile-1", question: "Show user user-1" }, "owner-1", state.emit);

  const proposal = state.executions.find((item) => item.name === "admin_user_get");
  assert.equal(proposal?.status, "proposed");
  assert.equal((proposal?.input as { request?: { path?: string } }).request?.path, "/admin/users/user-1");
  assert.ok(state.runUpdates.some(({ status }) => status === "awaiting_approval"));
  assert.ok(state.events.some(({ event }) => event === "tool_approval_required"));
  assert.ok(!state.events.some(({ event }) => event === "completed"));
});

test("discovers API tools without approval before planning the exact operation", async () => {
  const state = harness([
    { mode: "discover", query: "inspect user", domain: "users" },
    { mode: "api", tool: "admin_user_get", purpose: "Inspect the requested user", input: { path: { id: "user-1" } } }
  ], [], 1, true);

  await state.service.ask("conversation-1", { profileId: "profile-1", question: "Show user user-1" }, "owner-1", state.emit);

  const discovery = state.executions.find((item) => item.name === "discover_admin_tools");
  assert.equal(discovery?.status, "completed");
  assert.equal(discovery?.row_count, 1);
  assert.ok(state.events.some(({ event, data }) => event === "tool_result" && (data as { tool?: string }).tool === "discover_admin_tools"));
  assert.equal(state.executions.find((item) => item.name === "admin_user_get")?.status, "proposed");
});

test("describes the live capability catalog before answering what the assistant can do", async () => {
  const state = harness([{ mode: "capabilities" }, { mode: "answer" }], [], 1, true);
  await state.service.ask("conversation-1", { profileId: "profile-1", question: "What can you do?" }, "owner-1", state.emit);
  const execution = state.executions.find((item) => item.name === "describe_admin_capabilities");
  assert.equal(execution?.status, "completed");
  assert.equal(execution?.row_count, 1);
  assert.ok(Array.isArray(((execution?.result as { rows?: Array<{ featureAreas?: unknown }> } | null)?.rows?.[0])?.featureAreas));
  assert.ok(state.events.some(({ event, data }) => event === "tool_result" && (data as { tool?: string }).tool === "describe_admin_capabilities"));
  assert.ok(state.events.some(({ event }) => event === "completed"));
});

test("executes an approved admin tool in the browser and resumes from its bounded result", async () => {
  const state = harness([
    { mode: "api", tool: "admin_user_get", purpose: "Inspect the requested user", input: { path: { id: "user-1" } } },
    { mode: "answer" }
  ], [], 1, true);
  await state.service.ask("conversation-1", { profileId: "profile-1", question: "Show user user-1" }, "owner-1", state.emit);
  const proposal = state.executions.find((item) => item.name === "admin_user_get")!;

  await state.service.approve(proposal.id, "owner-1", state.emit);
  assert.equal(proposal.status, "running");
  assert.equal(proposal.approved_by_id, "owner-1");
  assert.ok(state.events.some(({ event }) => event === "browser_tool_request"));

  await state.service.submitAdminToolResult(proposal.id, { ok: true, status: 200, data: { id: "user-1", fullName: "Example" }, durationMs: 12 }, "owner-1", state.emit);
  assert.equal(proposal.status, "completed");
  assert.equal(proposal.row_count, 1);
  assert.ok(state.events.some(({ event }) => event === "tool_result"));
  assert.ok(state.events.some(({ event }) => event === "completed"));
});

test("lets the owner stop a browser tool left waiting after approval", async () => {
  const pending: Execution = { id: "execution-running", run_id: "run-1", name: "admin_user_get", kind: "tool", status: "running", input: { request: { method: "GET", path: "/admin/users/user-1" } }, result: null, row_count: null, duration_ms: null, approved_by_id: "owner-1", approved_at: new Date(), created_at: new Date() };
  const state = harness([], [pending], 1, true);
  state.runUpdates.push({ status: "awaiting_approval" });
  await state.service.reject(pending.id, "owner-1");
  assert.equal(pending.status, "rejected");
  assert.ok(state.runUpdates.some(({ status }) => status === "rejected"));
});
