import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { DateTime } from "luxon";
import type { PrismaService } from "../../prisma/prisma.service";
import { BackupSettingsService } from "./backup-settings.service";

describe("BackupSettingsService scheduling", () => {
  const service = new BackupSettingsService({} as PrismaService);

  it("schedules a daily local time in UTC for the configured IANA zone", () => {
    const next = service.nextRun({ frequency: "daily", weekdays: [], localTime: "02:00", timezone: "Asia/Tehran" }, DateTime.fromISO("2026-09-22T20:00:00Z"));
    assert.equal(next.toISO(), "2026-09-22T22:30:00.000Z");
  });

  it("maps Luxon weekdays to the public Sunday-zero weekday contract", () => {
    const next = service.nextRun({ frequency: "weekly", weekdays: [0], localTime: "09:15", timezone: "UTC" }, DateTime.fromISO("2026-09-21T10:00:00Z"));
    assert.equal(next.toISO(), "2026-09-27T09:15:00.000Z");
  });

  it("returns a valid future instant across a spring DST gap", () => {
    const from = DateTime.fromISO("2026-03-08T06:00:00Z");
    const next = service.nextRun({ frequency: "daily", weekdays: [], localTime: "02:30", timezone: "America/New_York" }, from);
    assert.equal(next.isValid, true);
    assert.ok(next > from);
    assert.equal(next.setZone("America/New_York").day, 8);
  });

  it("rejects an unknown timezone", () => {
    assert.throws(() => service.nextRun({ frequency: "daily", weekdays: [], localTime: "02:00", timezone: "Not/AZone" }, DateTime.utc()), /timezone/i);
  });
});
