import { IsString, MaxLength } from "class-validator";

export class UpdateComplaintsSettingsDto {
  @IsString()
  @MaxLength(40)
  phoneNumber!: string;

  @IsString()
  @MaxLength(64)
  telegramId!: string;
}
