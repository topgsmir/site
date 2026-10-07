import { Controller, Get, Headers, Param, Res } from "@nestjs/common";
import { ProfilePictureService } from "./profile-picture.service";

type ImageResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): ImageResponse;
  end(): unknown;
  send(body: Buffer): unknown;
};

@Controller("user-pictures")
export class UserPictureController {
  constructor(private readonly pictures: ProfilePictureService) {}

  @Get(":userId/picture.webp")
  async get(
    @Param("userId") userId: string,
    @Headers("if-none-match") ifNoneMatch: string | undefined,
    @Res() response: ImageResponse
  ) {
    const picture = await this.pictures.get(userId);
    response.setHeader("Content-Type", "image/webp");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("ETag", picture.etag);
    if (ifNoneMatch === picture.etag) return response.status(304).end();
    return response.send(picture.buffer);
  }
}
