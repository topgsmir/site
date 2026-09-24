import { Injectable } from "@nestjs/common";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, streamText } from "ai";
import { SafeFetchService } from "../../common/http/safe-fetch.service";
import { AI_REQUEST_TIMEOUT_MS } from "./ai-request-policy";
import { parseAiJson, type AiCompletion, type AiModelAdapter, type AiProfileCredentials, type AiStructuredCompletion, type AiToolCallCompletion } from "./ai.types";

@Injectable()
export class AnthropicAdapter implements AiModelAdapter {
  readonly provider = "anthropic" as const;
  constructor(private readonly safeFetch: SafeFetchService) {}
  async complete(profile: AiProfileCredentials, system: string, prompt: string): Promise<AiCompletion> {
    const client = createAnthropic({ apiKey: profile.apiKey, baseURL: profile.baseUrl, fetch: this.safeFetch.withTimeout(AI_REQUEST_TIMEOUT_MS) });
    const result = await generateText({ model: client(profile.modelId), system, prompt, maxOutputTokens: 4_000, maxRetries: 0, abortSignal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS) });
    return { text: result.text.slice(0, 30_000), inputTokens: result.usage.inputTokens ?? null, outputTokens: result.usage.outputTokens ?? null, providerRequestId: result.providerMetadata?.anthropic?.requestId as string ?? null };
  }
  async stream(profile: AiProfileCredentials, system: string, prompt: string, onText: (text: string) => void): Promise<AiCompletion> {
    const client = createAnthropic({ apiKey: profile.apiKey, baseURL: profile.baseUrl, fetch: this.safeFetch.withTimeout(AI_REQUEST_TIMEOUT_MS) });
    const result = streamText({ model: client(profile.modelId), system, prompt, maxOutputTokens: 4_000, maxRetries: 0, abortSignal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS) });
    let text = "";
    for await (const part of result.fullStream) { if (part.type === "error") throw part.error; if (part.type !== "text-delta") continue; const delta = part.text; if (text.length >= 30_000) continue; const bounded = delta.slice(0, 30_000 - text.length); text += bounded; onText(bounded); }
    const usage = await result.usage; const metadata = await result.providerMetadata;
    return { text, inputTokens: usage.inputTokens ?? null, outputTokens: usage.outputTokens ?? null, providerRequestId: metadata?.anthropic?.requestId as string ?? null };
  }
  async structured<T>(profile: AiProfileCredentials, system: string, prompt: string, validate: (value: unknown) => T): Promise<AiStructuredCompletion<T>> { const completion = await this.complete(profile, system, prompt); return { ...completion, value: validate(parseAiJson(completion.text)) }; }
  async toolCall(profile: AiProfileCredentials, system: string, prompt: string, allowedTools: ReadonlySet<string>): Promise<AiToolCallCompletion> { const result = await this.structured(profile, system, prompt, (value) => { const call = value as { name?: unknown; input?: unknown }; if (typeof call?.name !== "string" || !allowedTools.has(call.name) || !call.input || typeof call.input !== "object" || Array.isArray(call.input)) throw new Error("invalid_tool_call"); return { name: call.name, input: call.input as Record<string, unknown> }; }); return { text: result.text, inputTokens: result.inputTokens, outputTokens: result.outputTokens, providerRequestId: result.providerRequestId, toolCall: result.value }; }
}
