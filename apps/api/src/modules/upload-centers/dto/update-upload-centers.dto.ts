import { IsString, MaxLength } from "class-validator";

export class UpdateUploadCentersDto {
  @IsString()
  @MaxLength(2048)
  freeUrl!: string;

  @IsString()
  @MaxLength(2048)
  regularUrl!: string;
}
