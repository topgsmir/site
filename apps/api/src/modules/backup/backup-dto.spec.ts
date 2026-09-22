import "reflect-metadata";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { BackupRestorePreflightDto, CreateBackupDestinationDto, CreateBackupRunDto, UpdateBackupSettingsDto } from "./dto/backup.dto";

describe("backup DTO validation", () => {
  it("requires at least one unique backup component", async () => {
    assert.ok((await validate(plainToInstance(CreateBackupRunDto, { components: [] }))).length > 0);
    assert.ok((await validate(plainToInstance(CreateBackupRunDto, { components: ["database", "database"] }))).length > 0);
    assert.equal((await validate(plainToInstance(CreateBackupRunDto, { components: ["database", "uploads"] }))).length, 0);
  });

  it("bounds schedule fields and validates time syntax", async () => {
    const dto = plainToInstance(UpdateBackupSettingsDto, {
      automationEnabled: true, frequency: "weekly", weekdays: [7], localTime: "24:01", timezone: "Asia/Tehran",
      includeDatabase: true, includeUploads: true, localRetentionCount: 101
    });
    assert.deepEqual(new Set((await validate(dto)).map((error) => error.property)), new Set(["weekdays", "localTime", "localRetentionCount"]));
  });

  it("requires a pinned host key for SFTP and explicit typed remote restore fields", async () => {
    const destination = plainToInstance(CreateBackupDestinationDto, {
      name: "Offsite", protocol: "sftp", host: "backup.example.com", port: 22, username: "backup",
      remotePath: "/topgsm", retentionCount: 30, allowInsecure: false, password: "secret"
    });
    assert.ok((await validate(destination)).some((error) => error.property === "hostKeyFingerprint"));

    const remote = plainToInstance(BackupRestorePreflightDto, {
      destinationId: "00000000-0000-4000-8000-000000000001",
      remoteName: "../../database.dump"
    });
    assert.ok((await validate(remote)).some((error) => error.property === "remoteName"));
  });
});
