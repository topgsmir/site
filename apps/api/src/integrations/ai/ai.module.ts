import { Module } from "@nestjs/common";
import { AuthModule } from "../../modules/auth/auth.module";
import { CredentialCryptoService } from "../../common/security/credential-crypto.service";
import { PublicUrlService } from "../../common/http/public-url.service";
import { SafeFetchService } from "../../common/http/safe-fetch.service";
import { AiProfileController } from "./ai-profile.controller";
import { AiProfileService } from "./ai-profile.service";
import { AiModelService } from "./ai-model.service";
import { OpenAiAdapter } from "./openai.adapter";
import { AnthropicAdapter } from "./anthropic.adapter";

@Module({ imports: [AuthModule], controllers: [AiProfileController], providers: [CredentialCryptoService, PublicUrlService, SafeFetchService, OpenAiAdapter, AnthropicAdapter, AiModelService, AiProfileService], exports: [AiModelService, AiProfileService] })
export class AiModule {}
