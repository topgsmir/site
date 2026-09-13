import { IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateConversationDto {
  @IsString() @MinLength(1) @MaxLength(160) title = "New analysis";
}

export class AskDataAssistantDto {
  @IsUUID("4") profileId!: string;
  @IsString() @MinLength(2) @MaxLength(4000) question!: string;
}
