import { BadGatewayException, Injectable } from "@nestjs/common";
import { CredentialCryptoService } from "../../common/security/credential-crypto.service";
import type { AiCompletion, AiModelAdapter, AiStructuredCompletion, AiToolCallCompletion } from "./ai.types";
import { AnthropicAdapter } from "./anthropic.adapter";
import { OpenAiAdapter } from "./openai.adapter";

type StoredProfile = { id: string; provider: "openai" | "anthropic"; model_id: string; base_url: string; encrypted_api_key: string; encryption_key_id: string };

@Injectable()
export class AiModelService {
  private readonly adapters: Map<string, AiModelAdapter>;
  constructor(openai: OpenAiAdapter, anthropic: AnthropicAdapter, private readonly crypto: CredentialCryptoService) {
    this.adapters = new Map<string, AiModelAdapter>([[openai.provider, openai], [anthropic.provider, anthropic]]);
  }
  async complete(profile: StoredProfile, system: string, prompt: string): Promise<AiCompletion> {
    const adapter = this.adapters.get(profile.provider);
    if (!adapter) throw new BadGatewayException("AI provider is unsupported");
    return adapter.complete({ id: profile.id, provider: profile.provider, modelId: profile.model_id, baseUrl: profile.base_url, apiKey: this.crypto.decrypt(profile.encrypted_api_key, profile.encryption_key_id, `ai:${profile.id}:api-key`, "AI") }, system, prompt);
  }
  async stream(profile: StoredProfile, system: string, prompt: string, onText: (text: string) => void): Promise<AiCompletion> {
    const adapter = this.adapters.get(profile.provider);
    if (!adapter) throw new BadGatewayException("AI provider is unsupported");
    return adapter.stream({ id: profile.id, provider: profile.provider, modelId: profile.model_id, baseUrl: profile.base_url, apiKey: this.crypto.decrypt(profile.encrypted_api_key, profile.encryption_key_id, `ai:${profile.id}:api-key`, "AI") }, system, prompt, onText);
  }
  async structured<T>(profile: StoredProfile, system: string, prompt: string, validate: (value: unknown) => T): Promise<AiStructuredCompletion<T>> { const adapter = this.adapter(profile); return adapter.structured(this.credentials(profile), system, prompt, validate); }
  async toolCall(profile: StoredProfile, system: string, prompt: string, allowedTools: ReadonlySet<string>): Promise<AiToolCallCompletion> { const adapter = this.adapter(profile); return adapter.toolCall(this.credentials(profile), system, prompt, allowedTools); }
  private adapter(profile: StoredProfile) { const adapter = this.adapters.get(profile.provider); if (!adapter) throw new BadGatewayException("AI provider is unsupported"); return adapter; }
  private credentials(profile: StoredProfile) { return { id: profile.id, provider: profile.provider, modelId: profile.model_id, baseUrl: profile.base_url, apiKey: this.crypto.decrypt(profile.encrypted_api_key, profile.encryption_key_id, `ai:${profile.id}:api-key`, "AI") }; }
}
