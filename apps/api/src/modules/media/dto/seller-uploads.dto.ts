import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class RequestUploadDeletionDto {
  @IsString() @MinLength(3) @MaxLength(500)
  reason!: string;
}

export class RejectUploadDeletionDto {
  @IsString() @MinLength(3) @MaxLength(500)
  reason!: string;
}

export class DeletionQueueQueryDto {
  @IsOptional() @IsUUID("4")
  cursor?: string;
}
