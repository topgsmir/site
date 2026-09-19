import { IsBoolean } from "class-validator";

export class UpdateAuthLoginSettingsDto {
  @IsBoolean()
  emailPasswordEnabled!: boolean;

  @IsBoolean()
  phoneOtpEnabled!: boolean;
}
