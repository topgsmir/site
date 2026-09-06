import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BlogController } from "./blog.controller";
import { BlogService } from "./blog.service";
import { SellerBlogGuard } from "./seller-blog.guard";

@Module({
  imports: [AuthModule],
  controllers: [BlogController],
  providers: [BlogService, SellerBlogGuard]
})
export class BlogModule {}
