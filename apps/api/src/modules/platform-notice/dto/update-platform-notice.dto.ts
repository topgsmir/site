import { IsBoolean, IsString, MaxLength } from "class-validator";

export class UpdatePlatformNoticeDto {
  @IsString()
  @MaxLength(500)
  message!: string;

  @IsBoolean()
  enabled!: boolean;
}
