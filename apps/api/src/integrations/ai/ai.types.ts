export type AiProviderCode = "openai" | "anthropic";

export type AiProfileCredentials = {
  id: string;
  provider: AiProviderCode;
  modelId: string;
  baseUrl: string;
  apiKey: string;
};

export type AiCompletion = {
  text: string;
  inputTokens: number | null;
  outputTokens: number | null;
  providerRequestId: string | null;
};

export type AiStructuredCompletion<T> = AiCompletion & { value: T };
export type AiToolCallCompletion = AiCompletion & { toolCall: { name: string; input: Record<string, unknown> } };

export function parseAiJson(text: string): unknown { return JSON.parse(text.replace(/^```json\s*|\s*```$/g, "")); }

export interface AiModelAdapter {
  readonly provider: AiProviderCode;
  complete(profile: AiProfileCredentials, system: string, prompt: string): Promise<AiCompletion>;
  stream(profile: AiProfileCredentials, system: string, prompt: string, onText: (text: string) => void): Promise<AiCompletion>;
  structured<T>(profile: AiProfileCredentials, system: string, prompt: string, validate: (value: unknown) => T): Promise<AiStructuredCompletion<T>>;
  toolCall(profile: AiProfileCredentials, system: string, prompt: string, allowedTools: ReadonlySet<string>): Promise<AiToolCallCompletion>;
}
