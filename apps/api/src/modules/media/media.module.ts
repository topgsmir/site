import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BlogModule } from "../blog/blog.module";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";

@Module({
  imports: [AuthModule, BlogModule],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService]
})
export class MediaModule {}
