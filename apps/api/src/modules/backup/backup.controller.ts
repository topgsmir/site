import {
  BadRequestException, Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Ip, NotFoundException, Param, Patch, Post, Query, Req, Res,
  StreamableFile, UploadedFile, UseGuards, UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { createReadStream, mkdirSync } from "node:fs";
import { rm } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { diskStorage } from "multer";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { BrowserSessionMutation } from "../auth/browser-session-mutation.decorator";
import { PlatformAdminGuard, type AuthenticatedRequest } from "../auth/platform-admin.guard";
import { BackupDestinationService } from "./backup-destination.service";
import { readRestoreProgress, readSystemStatus, verifyRestoreMonitorToken } from "./backup-maintenance";
import { BackupRestoreService } from "./backup-restore.service";
import { BackupRunService } from "./backup-run.service";
import { BackupSettingsService } from "./backup-settings.service";
import {
  BackupRestorePreflightDto, ConfirmBackupRestoreDto, CreateBackupDestinationDto, CreateBackupRunDto,
  ListBackupRunsDto, RefreshRemoteBackupCatalogDto, UpdateBackupDestinationDto, UpdateBackupSettingsDto
} from "./dto/backup.dto";

const uploadRoot = (() => {
  const configured = process.env.BACKUP_ROOT?.trim() || "var/backups";
  const root = isAbsolute(configured) ? resolve(configured) : resolve(process.cwd(), configured);
  const destination = resolve(root, "staging");
  mkdirSync(destination, { recursive: true });
  return destination;
})();
const maxUploadBytes = (() => {
  const parsed = Number(process.env.BACKUP_MAX_ARCHIVE_BYTES);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 25 * 1024 ** 3;
})();

@Controller("system")
export class BackupSystemController {
  @Get("status") status() { return readSystemStatus(); }

  @Get("restores/:id")
  async restoreStatus(@Param("id") id: string, @Headers("authorization") authorization?: string) {
    const token = authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1] ?? "";
    if (!await verifyRestoreMonitorToken(id, token)) throw new NotFoundException("Restore status was not found");
    const progress = await readRestoreProgress(id);
    if (!progress) throw new NotFoundException("Restore status was not found");
    return progress;
  }
}

@Controller("admin/backups")
@UseGuards(PlatformAdminGuard)
export class BackupController {
  constructor(
    private readonly settings: BackupSettingsService,
    private readonly destinations: BackupDestinationService,
    private readonly runs: BackupRunService,
    private readonly restore: BackupRestoreService,
    private readonly rateLimits: AuthRateLimitService
  ) {}

  @Get("overview") overview() { return this.runs.overview(); }
  @Get("settings") settingsView() { return this.settings.get(); }

  @Patch("settings")
  @BrowserSessionMutation()
  async updateSettings(@Body() body: UpdateBackupSettingsDto, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeBackupAdmin(request.authenticatedUser!.id, clientIp);
    return this.settings.update(body, request.authenticatedUser!.id);
  }

  @Get("destinations") listDestinations() { return this.destinations.list(); }

  @Post("destinations")
  @BrowserSessionMutation()
  async createDestination(@Body() body: CreateBackupDestinationDto, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeBackupAdmin(request.authenticatedUser!.id, clientIp);
    return this.destinations.create(body, request.authenticatedUser!.id);
  }

  @Patch("destinations/:id")
  @BrowserSessionMutation()
  async updateDestination(@Param("id") id: string, @Body() body: UpdateBackupDestinationDto, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeBackupAdmin(request.authenticatedUser!.id, clientIp);
    return this.destinations.update(id, body, request.authenticatedUser!.id);
  }

  @Delete("destinations/:id")
  @BrowserSessionMutation()
  async removeDestination(@Param("id") id: string, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeBackupAdmin(request.authenticatedUser!.id, clientIp);
    return this.destinations.remove(id, request.authenticatedUser!.id);
  }

  @Post("destinations/:id/test")
  @HttpCode(HttpStatus.OK)
  @BrowserSessionMutation()
  async testDestination(@Param("id") id: string, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeBackupAdmin(request.authenticatedUser!.id, clientIp);
    return this.destinations.test(id, request.authenticatedUser!.id);
  }

  @Get("runs") listRuns(@Query() query: ListBackupRunsDto) { return this.runs.list(query); }
  @Post("runs/remote-refresh")
  @HttpCode(HttpStatus.OK)
  @BrowserSessionMutation()
  async refreshRemote(@Body() body: RefreshRemoteBackupCatalogDto, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeBackupAdmin(request.authenticatedUser!.id, clientIp);
    return this.destinations.listArchives(body.destinationId);
  }
  @Get("runs/:id") getRun(@Param("id") id: string) { return this.runs.get(id); }

  @Post("runs")
  @HttpCode(HttpStatus.ACCEPTED)
  @BrowserSessionMutation()
  async createRun(@Body() body: CreateBackupRunDto, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeBackupAdmin(request.authenticatedUser!.id, clientIp);
    const row = await this.runs.queue(body.components, request.authenticatedUser!.id);
    return this.runs.map(row);
  }

  @Get("runs/:id/download")
  async download(@Param("id") id: string, @Res({ passthrough: true }) response: { setHeader(name: string, value: string): void }) {
    const archive = await this.runs.archiveForDownload(id);
    response.setHeader("Content-Type", "application/octet-stream");
    response.setHeader("Content-Disposition", `attachment; filename="${archive.name}"`);
    response.setHeader("Cache-Control", "no-store");
    return new StreamableFile(createReadStream(archive.path));
  }

  @Post("restore-uploads")
  @HttpCode(HttpStatus.CREATED)
  @BrowserSessionMutation()
  @UseInterceptors(FileInterceptor("file", {
    storage: diskStorage({
      destination: uploadRoot,
      filename: (_request, _file, callback) => callback(null, `${randomUUID()}.upload`)
    }),
    limits: { files: 1, fileSize: maxUploadBytes }
  }))
  async uploadRestore(@UploadedFile() file: Express.Multer.File | undefined, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    if (!file) throw new BadRequestException("An encrypted TopGSM backup package is required");
    try {
      await this.rateLimits.consumeBackupRestore(request.authenticatedUser!.id, clientIp);
      return { uploadId: file.filename.replace(/[.]upload$/, ""), bytes: file.size };
    } catch (error) {
      await rm(file.path, { force: true });
      throw error;
    }
  }

  @Post("restores/preflight")
  @BrowserSessionMutation()
  async preflight(@Body() body: BackupRestorePreflightDto, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeBackupRestore(request.authenticatedUser!.id, clientIp);
    return this.restore.preflight(body, request.authenticatedUser!.id);
  }

  @Post("restores/confirm")
  @HttpCode(HttpStatus.ACCEPTED)
  @BrowserSessionMutation()
  async confirm(@Body() body: ConfirmBackupRestoreDto, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeBackupRestore(request.authenticatedUser!.id, clientIp);
    return this.restore.confirm(body, request.authenticatedUser!.id);
  }
}
