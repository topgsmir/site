import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from "class-validator";
import { SMS_EVENTS, SMS_PRODUCT_TYPES, SMS_RECIPIENT_KINDS, SMS_ROLES } from "../sms-events";

export class SaveSmsRuleDto {
  @IsIn(SMS_EVENTS)
  eventKey!: (typeof SMS_EVENTS)[number];

  @IsIn(SMS_PRODUCT_TYPES)
  productType!: (typeof SMS_PRODUCT_TYPES)[number];

  @IsIn(SMS_RECIPIENT_KINDS)
  recipientKind!: (typeof SMS_RECIPIENT_KINDS)[number];

  @ValidateIf((value: SaveSmsRuleDto) => value.recipientKind === "role")
  @IsIn(SMS_ROLES)
  recipientRole?: (typeof SMS_ROLES)[number] | null;

  @ValidateIf((value: SaveSmsRuleDto) => value.recipientKind === "phone")
  @IsString()
  @MaxLength(16)
  phoneNumber?: string | null;

  @IsBoolean()
  enabled!: boolean;

  @IsOptional() @IsInt() @Min(1) @Max(2_147_483_647)
  templateId?: number | null;

  @IsOptional() @IsString() @MaxLength(1000)
  messageText?: string | null;
}

export class SmsDeliveryQueryDto {
  @IsOptional() @IsIn(SMS_EVENTS)
  eventKey?: (typeof SMS_EVENTS)[number];

  @IsOptional() @IsIn(["pending", "sending", "sent", "failed"])
  status?: "pending" | "sending" | "sent" | "failed";

  @IsOptional() @IsString() @MaxLength(100)
  cursor?: string;
}
