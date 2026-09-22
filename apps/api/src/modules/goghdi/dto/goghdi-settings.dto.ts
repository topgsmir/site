import { IsBoolean, IsOptional, IsString, IsUrl, MaxLength, MinLength } from "class-validator";

const urlOptions = {
  protocols: ["http", "https"],
  require_protocol: true,
  require_tld: false
};

export class UpdateGoghdiSettingsDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsUrl(urlOptions)
  @MaxLength(2048)
  sdkUrl?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  tenantId?: string | null;

  @IsOptional()
  @IsUrl(urlOptions)
  @MaxLength(2048)
  apiUrl?: string | null;

  @IsOptional()
  @IsUrl(urlOptions)
  @MaxLength(2048)
  socketUrl?: string | null;

  @IsOptional()
  @IsUrl(urlOptions)
  @MaxLength(2048)
  widgetUrl?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(16)
  @MaxLength(2000)
  tenantSecret?: string;
}
