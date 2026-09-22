import { Type } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";

export class DigitalDownloadQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(49)
  fileIndex = 0;
}
