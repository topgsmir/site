import { Module } from "@nestjs/common";
import { AiModule } from "../../integrations/ai/ai.module";
import { AuthModule } from "../auth/auth.module";
import { DataAssistantCleanupService } from "./data-assistant-cleanup.service";
import { DataAssistantController } from "./data-assistant.controller";
import { DataAssistantService } from "./data-assistant.service";
import { ReportingQueryService } from "./reporting-query.service";
import { ReportingToolsService } from "./reporting-tools.service";

@Module({ imports: [AuthModule, AiModule], controllers: [DataAssistantController], providers: [DataAssistantService, DataAssistantCleanupService, ReportingQueryService, ReportingToolsService] })
export class DataAssistantModule {}
