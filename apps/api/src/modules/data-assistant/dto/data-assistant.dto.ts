import { IsBoolean, IsDefined, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from "class-validator";

export class CreateConversationDto {
  @IsString() @MinLength(1) @MaxLength(160) title = "New analysis";
}

export class AskDataAssistantDto {
  @IsUUID("4") profileId!: string;
  @IsString() @MinLength(2) @MaxLength(4000) question!: string;
}

export class SubmitAdminToolResultDto {
  @IsBoolean() ok!: boolean;
  @IsInt() @Min(100) @Max(599) status!: number;
  @IsDefined() data!: unknown;
  @IsOptional() @IsString() @MaxLength(100) errorCode?: string;
  @IsOptional() @IsInt() @Min(0) @Max(120_000) durationMs?: number;
}
