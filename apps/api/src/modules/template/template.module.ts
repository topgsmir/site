import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { HomepageModule } from "../homepage/homepage.module";
import { AdminTemplateController, PublicTemplateController } from "./template.controller";
import { TemplateSettingsService } from "./template.service";
@Module({ imports: [AuthModule, HomepageModule], controllers: [PublicTemplateController, AdminTemplateController], providers: [TemplateSettingsService] })
export class TemplateModule {}
