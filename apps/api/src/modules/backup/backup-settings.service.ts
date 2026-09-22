import { BadRequestException, Injectable } from "@nestjs/common";
import type { AdminBackupSettings } from "@topgsm/shared-types";
import { DateTime } from "luxon";
import { PrismaService } from "../../prisma/prisma.service";
import type { UpdateBackupSettingsDto } from "./dto/backup.dto";

const SETTINGS_ID = 1;

@Injectable()
export class BackupSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<AdminBackupSettings> {
    const row = await this.prisma.backup_settings.upsert({ where: { id: SETTINGS_ID }, create: { id: SETTINGS_ID }, update: {} });
    return this.map(row);
  }

  async update(input: UpdateBackupSettingsDto, actorUserId: string): Promise<AdminBackupSettings> {
    this.validate(input);
    const nextRunAt = input.automationEnabled ? this.nextRun(input, DateTime.utc()).toJSDate() : null;
    const updated = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.backup_settings.upsert({ where: { id: SETTINGS_ID }, create: { id: SETTINGS_ID }, update: {} });
      const data = {
        automation_enabled: input.automationEnabled,
        frequency: input.frequency,
        weekdays: input.frequency === "weekly" ? [...input.weekdays].sort() : [],
        local_time: input.localTime,
        timezone: input.timezone,
        include_database: input.includeDatabase,
        include_uploads: input.includeUploads,
        local_retention_count: input.localRetentionCount,
        next_run_at: nextRunAt,
        run_token: null
      };
      const row = await transaction.backup_settings.update({ where: { id: SETTINGS_ID }, data });
      await transaction.backup_setting_events.create({
        data: { settings_id: SETTINGS_ID, actor_user_id: actorUserId, before_data: this.eventData(current), after_data: this.eventData(row) }
      });
      return row;
    });
    return this.map(updated);
  }

  nextRun(input: Pick<UpdateBackupSettingsDto, "frequency" | "weekdays" | "localTime" | "timezone">, from: DateTime) {
    const zoneNow = from.setZone(input.timezone);
    if (!zoneNow.isValid) throw new BadRequestException("Backup timezone is invalid");
    const [hour, minute] = input.localTime.split(":").map(Number);
    for (let offset = 0; offset <= 8; offset += 1) {
      const candidate = zoneNow.plus({ days: offset }).set({ hour, minute, second: 0, millisecond: 0 });
      if (candidate <= zoneNow) continue;
      if (input.frequency === "daily" || input.weekdays.includes(candidate.weekday % 7)) return candidate.toUTC();
    }
    throw new BadRequestException("Weekly backup schedule has no eligible weekday");
  }

  private validate(input: UpdateBackupSettingsDto) {
    if (!input.includeDatabase && !input.includeUploads) throw new BadRequestException("Select the database, uploads, or both");
    if (input.frequency === "weekly" && input.weekdays.length === 0) throw new BadRequestException("Select at least one weekday for weekly backups");
    const zone = DateTime.now().setZone(input.timezone);
    if (!zone.isValid) throw new BadRequestException("Backup timezone is invalid");
  }

  private map(row: Awaited<ReturnType<typeof this.prisma.backup_settings.upsert>>): AdminBackupSettings {
    return {
      automationEnabled: row.automation_enabled,
      frequency: row.frequency as "daily" | "weekly",
      weekdays: row.weekdays,
      localTime: row.local_time,
      timezone: row.timezone,
      includeDatabase: row.include_database,
      includeUploads: row.include_uploads,
      localRetentionCount: row.local_retention_count,
      nextRunAt: row.next_run_at?.toISOString() ?? null,
      lastRunStatus: row.last_run_status as AdminBackupSettings["lastRunStatus"],
      lastSuccessAt: row.last_success_at?.toISOString() ?? null,
      lastFailureAt: row.last_failure_at?.toISOString() ?? null,
      updatedAt: row.updated_at?.toISOString() ?? null
    };
  }

  private eventData(row: {
    automation_enabled: boolean; frequency: string; weekdays: number[]; local_time: string; timezone: string;
    include_database: boolean; include_uploads: boolean; local_retention_count: number; next_run_at: Date | null;
  }) {
    return {
      automationEnabled: row.automation_enabled, frequency: row.frequency, weekdays: row.weekdays,
      localTime: row.local_time, timezone: row.timezone, includeDatabase: row.include_database,
      includeUploads: row.include_uploads, localRetentionCount: row.local_retention_count,
      nextRunAt: row.next_run_at?.toISOString() ?? null
    };
  }
}
