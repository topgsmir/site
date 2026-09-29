import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ClubCoreModule } from "./club-core.module";
import { ClubController } from "./club.controller";
import { ClubAdminController } from "./club-admin.controller";
import { ClubAdminService } from "./club-admin.service";
import { ClubOutboxWorker } from "./club-outbox.worker";

@Module({ imports: [AuthModule, ClubCoreModule], controllers: [ClubController, ClubAdminController], providers: [ClubAdminService, ClubOutboxWorker] })
export class ClubModule {}
