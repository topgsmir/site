import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf
} from "class-validator";

const TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const HOST_PATTERN = /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?!-)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;
const FINGERPRINT_PATTERN = /^SHA256:[A-Za-z0-9+/]{43}=?$/;

export class UpdateBackupSettingsDto {
  @IsBoolean() automationEnabled!: boolean;
  @IsIn(["daily", "weekly"]) frequency!: "daily" | "weekly";
  @IsArray() @ArrayMaxSize(7) @ArrayUnique() @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) weekdays!: number[];
  @IsString() @Matches(TIME_PATTERN) localTime!: string;
  @IsString() @MinLength(1) @MaxLength(64) timezone!: string;
  @IsBoolean() includeDatabase!: boolean;
  @IsBoolean() includeUploads!: boolean;
  @IsInt() @Min(1) @Max(100) localRetentionCount!: number;
}

export class CreateBackupDestinationDto {
  @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @IsIn(["sftp", "ftps", "ftp"]) protocol!: "sftp" | "ftps" | "ftp";
  @IsString() @Matches(HOST_PATTERN) host!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(65535) port!: number;
  @IsString() @MinLength(1) @MaxLength(200) username!: string;
  @IsString() @MinLength(1) @MaxLength(1000) remotePath!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(365) retentionCount = 30;
  @IsBoolean() allowInsecure = false;
  @IsOptional() @IsString() @MaxLength(4096) password?: string;
  @IsOptional() @IsString() @MaxLength(32768) privateKey?: string;
  @IsOptional() @IsString() @MaxLength(4096) privateKeyPassphrase?: string;
  @ValidateIf((value: CreateBackupDestinationDto) => value.protocol === "sftp")
  @IsString() @Matches(FINGERPRINT_PATTERN) hostKeyFingerprint?: string;
}

export class UpdateBackupDestinationDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) name?: string;
  @IsOptional() @IsIn(["sftp", "ftps", "ftp"]) protocol?: "sftp" | "ftps" | "ftp";
  @IsOptional() @IsString() @Matches(HOST_PATTERN) host?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) port?: number;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) username?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(1000) remotePath?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365) retentionCount?: number;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsBoolean() allowInsecure?: boolean;
  @IsOptional() @IsString() @MaxLength(4096) password?: string;
  @IsOptional() @IsString() @MaxLength(32768) privateKey?: string;
  @IsOptional() @IsString() @MaxLength(4096) privateKeyPassphrase?: string;
  @IsOptional() @IsString() @Matches(FINGERPRINT_PATTERN) hostKeyFingerprint?: string;
}

export class CreateBackupRunDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(2) @ArrayUnique() @IsIn(["database", "uploads"], { each: true })
  components!: Array<"database" | "uploads">;
}

export class ListBackupRunsDto {
  @IsOptional() @IsString() @MaxLength(500) cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}

export class BackupRestorePreflightDto {
  @IsOptional() @IsUUID() runId?: string;
  @IsOptional() @IsUUID() uploadId?: string;
  @IsOptional() @IsUUID() destinationId?: string;
  @IsOptional() @IsString() @Matches(/^topgsm-[0-9]{8}T[0-9]{6}Z-[0-9a-f-]{36}[.]topgsm-backup$/i) remoteName?: string;
}

export class RefreshRemoteBackupCatalogDto {
  @IsUUID() destinationId!: string;
}

export class ConfirmBackupRestoreDto {
  @IsUUID() challengeId!: string;
  @IsString() @MinLength(1) @MaxLength(512) password!: string;
  @IsString() @MinLength(1) @MaxLength(100) phrase!: string;
}
