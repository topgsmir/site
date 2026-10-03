import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { readdir, stat, statfs } from "node:fs/promises";
import { resolve } from "node:path";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import { BackupPathsService } from "./backup-paths.service";

@Injectable()
export class BackupUploadGuard implements CanActivate {
  private readonly maxArchiveBytes: number;
  private readonly maxStagingBytes: number;

  constructor(config: ConfigService, private readonly paths: BackupPathsService, private readonly rateLimits: AuthRateLimitService) {
    const archiveLimit = Number(config.get<string>("BACKUP_MAX_ARCHIVE_BYTES"));
    this.maxArchiveBytes = Number.isSafeInteger(archiveLimit) && archiveLimit > 0 ? archiveLimit : 25 * 1024 ** 3;
    const stagingLimit = Number(config.get<string>("BACKUP_MAX_STAGING_BYTES"));
    this.maxStagingBytes = Number.isSafeInteger(stagingLimit) && stagingLimit >= this.maxArchiveBytes
      ? stagingLimit : this.maxArchiveBytes * 4;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    await this.rateLimits.consumeBackupRestore(request.authenticatedUser!.id, request.ip ?? "");
    await this.paths.ensure();
    const declaredBytes = Number((request.headers as Record<string, string | undefined>)["content-length"]);
    const expectedBytes = Number.isSafeInteger(declaredBytes) && declaredBytes > 0
      ? Math.min(declaredBytes, this.maxArchiveBytes) : this.maxArchiveBytes;
    const [entries, volume] = await Promise.all([readdir(this.paths.staging, { withFileTypes: true }), statfs(this.paths.staging)]);
    let stagedBytes = 0;
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const metadata = await stat(resolve(this.paths.staging, entry.name)).catch(() => null);
      if (metadata) stagedBytes += metadata.size;
      if (stagedBytes + expectedBytes > this.maxStagingBytes) {
        throw new ServiceUnavailableException("Backup staging quota is full");
      }
    }
    if (volume.bavail * volume.bsize < expectedBytes * 2) {
      throw new ServiceUnavailableException("Backup volume does not have enough free space for an upload and restore staging");
    }
    return true;
  }
}
