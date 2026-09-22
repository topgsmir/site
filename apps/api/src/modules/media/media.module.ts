import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BlogModule } from "../blog/blog.module";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";
import { AdminUploadsController } from "./admin-uploads.controller";
import { AdminUploadsService } from "./admin-uploads.service";

@Module({
  imports: [AuthModule, BlogModule],
  controllers: [MediaController, AdminUploadsController],
  providers: [MediaService, AdminUploadsService],
  exports: [MediaService]
})
export class MediaModule {}
