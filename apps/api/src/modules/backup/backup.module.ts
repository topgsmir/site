import { Module } from "@nestjs/common";
import { CredentialCryptoService } from "../../common/security/credential-crypto.service";
import { AuthModule } from "../auth/auth.module";
import { BackupArchiveService } from "./backup-archive.service";
import { BackupController, BackupSystemController } from "./backup.controller";
import { BackupCreatorService } from "./backup-creator.service";
import { BackupDestinationService } from "./backup-destination.service";
import { BackupPathsService } from "./backup-paths.service";
import { BackupRestoreService } from "./backup-restore.service";
import { BackupRunService } from "./backup-run.service";
import { BackupSettingsService } from "./backup-settings.service";
import { BackupWorkerService } from "./backup-worker.service";
import { BackupCatalogService } from "./backup-catalog.service";

@Module({
  imports: [AuthModule],
  controllers: [BackupController, BackupSystemController],
  providers: [
    CredentialCryptoService, BackupPathsService, BackupArchiveService, BackupCreatorService,
    BackupDestinationService, BackupSettingsService, BackupRunService, BackupRestoreService, BackupCatalogService, BackupWorkerService
  ]
})
export class BackupModule {}
