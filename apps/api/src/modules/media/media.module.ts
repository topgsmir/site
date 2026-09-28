import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BlogModule } from "../blog/blog.module";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";
import { AdminUploadsController } from "./admin-uploads.controller";
import { AdminUploadsService } from "./admin-uploads.service";
import { SellerUploadsController } from "./seller-uploads.controller";
import { SellerUploadsGuard } from "./seller-uploads.guard";

@Module({
  imports: [AuthModule, BlogModule],
  controllers: [MediaController, AdminUploadsController, SellerUploadsController],
  providers: [MediaService, AdminUploadsService, SellerUploadsGuard],
  exports: [MediaService, AdminUploadsService]
})
export class MediaModule {}
