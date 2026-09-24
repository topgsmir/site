import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import {
  BlogManageController,
  BlogPublicController,
  BlogTaxonomyController
} from "./blog.controller";
import { BlogService } from "./blog.service";
import { BlogManageGuard } from "./blog-manage.guard";
import { AdminBlogSidebarController, PublicBlogSidebarController } from "./blog-sidebar.controller";
import { BlogSidebarService } from "./blog-sidebar.service";

@Module({
  imports: [AuthModule],
  controllers: [BlogManageController, BlogTaxonomyController, BlogPublicController, PublicBlogSidebarController, AdminBlogSidebarController],
  providers: [BlogService, BlogManageGuard, BlogSidebarService],
  exports: [BlogService, BlogManageGuard]
})
export class BlogModule {}
