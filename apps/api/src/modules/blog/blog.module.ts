import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import {
  BlogManageController,
  BlogPublicController,
  BlogTaxonomyController
} from "./blog.controller";
import { BlogService } from "./blog.service";
import { BlogManageGuard } from "./blog-manage.guard";

@Module({
  imports: [AuthModule],
  controllers: [BlogManageController, BlogTaxonomyController, BlogPublicController],
  providers: [BlogService, BlogManageGuard],
  exports: [BlogService, BlogManageGuard]
})
export class BlogModule {}
