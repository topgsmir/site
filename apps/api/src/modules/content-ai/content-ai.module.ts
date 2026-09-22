import { Module } from "@nestjs/common";
import { AiModule } from "../../integrations/ai/ai.module";
import { AuthModule } from "../auth/auth.module";
import { ContentAiController } from "./content-ai.controller";
import { ContentAiService } from "./content-ai.service";

@Module({ imports: [AiModule, AuthModule], controllers: [ContentAiController], providers: [ContentAiService] })
export class ContentAiModule {}
