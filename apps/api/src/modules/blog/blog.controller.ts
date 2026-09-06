import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import { BlogService } from "./blog.service";
import {
  CreateBlogPostDto,
  ListBlogPostsQueryDto
} from "./dto/blog-post.dto";
import { SellerBlogGuard } from "./seller-blog.guard";

@Controller("blog/posts")
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Get()
  list(@Query() query: ListBlogPostsQueryDto) {
    return this.blogService.listPublic(query);
  }

  @Get("mine")
  @UseGuards(SellerBlogGuard)
  listMine(
    @Query() query: ListBlogPostsQueryDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.blogService.listMine(request.sellerContext!.sellerId, query);
  }

  @Post()
  @UseGuards(SellerBlogGuard)
  create(
    @Body() body: CreateBlogPostDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.blogService.create(request.sellerContext!.sellerId, body);
  }

  @Get(":slug")
  get(@Param("slug") slug: string) {
    return this.blogService.getPublic(slug);
  }
}
