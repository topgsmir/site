import assert from "node:assert/strict";
import test from "node:test";
import { DataAssistantService } from "./data-assistant.service";

test("executes validated generated reporting SQL without requesting approval", async () => {
  const sql = "SELECT day, gross_amount FROM ai_reporting.daily_sales";
  const toolCreates: Array<Record<string, unknown>> = [];
  const runUpdates: Array<Record<string, unknown>> = [];
  const events: Array<{ event: string; data: unknown }> = [];
  const transactionClient = {
    ai_messages: { create: async () => ({ id: "message-input" }) },
    ai_runs: { create: async () => ({ id: "run-1" }) },
    ai_audit_events: { create: async () => ({ id: "audit-start" }) },
    ai_conversations: { update: async () => ({ id: "conversation-1" }) }
  };
  const prisma = {
    $transaction: async (operation: (tx: typeof transactionClient) => Promise<unknown>) => operation(transactionClient),
    ai_conversations: { findFirst: async () => ({ id: "conversation-1", title: "Analysis" }) },
    ai_messages: {
      findMany: async () => [],
      create: async () => ({ id: "message-output" })
    },
    ai_tool_executions: {
      create: async (args: { data: Record<string, unknown> }) => { toolCreates.push(args.data); return { id: "execution-1", name: "generated_reporting_query" }; },
      update: async () => ({ id: "execution-1" })
    },
    ai_runs: {
      findUniqueOrThrow: async () => ({ conversation_id: "conversation-1", requester_id: "owner-1", profile_id: "profile-1", input_tokens: null, output_tokens: null, input_price_per_million_usd_snapshot: null, output_price_per_million_usd_snapshot: null }),
      update: async (args: { data: Record<string, unknown> }) => { runUpdates.push(args.data); return { id: "run-1" }; }
    },
    ai_audit_events: { create: async () => ({ id: "audit-complete" }) }
  };
  const profile = { id: "profile-1", provider: "openai", model_id: "gpt-test", base_url: "https://api.openai.com/v1", input_price_per_million_usd: null, output_price_per_million_usd: null };
  const profiles = { activeById: async () => profile };
  let answerSystemPrompt = "";
  const models = {
    complete: async () => ({ text: JSON.stringify({ mode: "sql", purpose: "Daily sales", sql }), inputTokens: null, outputTokens: null }),
    stream: async (_profile: unknown, system: string, _prompt: string, onText: (text: string) => void) => { answerSystemPrompt = system; onText("Done"); return { text: "Done", inputTokens: 10, outputTokens: 2, providerRequestId: "request-1" }; }
  };
  const tools = { execute: async () => { throw new Error("predefined tool should not run"); } };
  const queries = {
    validate: (candidate: string) => { assert.equal(candidate, sql); return candidate; },
    execute: async (candidate: string) => { assert.equal(candidate, sql); return { rows: [{ day: "2026-09-13", gross_amount: "100" }], rowCount: 1, truncated: false, durationMs: 3 }; }
  };
  const service = new DataAssistantService(prisma as never, profiles as never, models as never, tools as never, queries as never);

  await service.ask("conversation-1", { profileId: "profile-1", question: "Show daily sales" }, "owner-1", (event, data) => events.push({ event, data }));

  assert.equal(toolCreates.length, 1);
  assert.equal(toolCreates[0]?.status, "running");
  assert.equal(toolCreates[0]?.kind, "sql");
  assert.ok(events.some(({ event }) => event === "tool_started"));
  assert.ok(events.some(({ event }) => event === "tool_result"));
  assert.ok(events.some(({ event }) => event === "completed"));
  assert.ok(!events.some(({ event }) => event === "sql_approval_required"));
  assert.ok(!runUpdates.some(({ status }) => status === "awaiting_approval"));
  assert.match(answerSystemPrompt, /valid GitHub Flavored Markdown/);
  assert.match(answerSystemPrompt, /do not repeat raw rows/);
});
