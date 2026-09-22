import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MulterModule } from "@nestjs/platform-express";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { diskStorage } from "multer";
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
  imports: [
    AuthModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const configured = config.get<string>("BACKUP_ROOT")?.trim() || "var/backups";
        const root = isAbsolute(configured) ? resolve(configured) : resolve(process.cwd(), configured);
        const destination = resolve(root, "staging");
        mkdirSync(destination, { recursive: true });
        const configuredLimit = Number(config.get<string>("BACKUP_MAX_ARCHIVE_BYTES"));
        const fileSize = Number.isSafeInteger(configuredLimit) && configuredLimit > 0 ? configuredLimit : 25 * 1024 ** 3;
        return {
          storage: diskStorage({ destination, filename: (_request, _file, callback) => callback(null, `${randomUUID()}.upload`) }),
          limits: { files: 1, fileSize }
        };
      }
    })
  ],
  controllers: [BackupController, BackupSystemController],
  providers: [
    CredentialCryptoService, BackupPathsService, BackupArchiveService, BackupCreatorService,
    BackupDestinationService, BackupSettingsService, BackupRunService, BackupRestoreService, BackupCatalogService, BackupWorkerService
  ]
})
export class BackupModule {}
