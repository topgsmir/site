import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import { BlogService } from "./blog.service";
import {
  CreateBlogPostDto,
  ListBlogPostsQueryDto,
  UpdateBlogPostDto
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

  @Get("mine/:postId")
  @UseGuards(SellerBlogGuard)
  getMine(
    @Param("postId", new ParseUUIDPipe({ version: "4" })) postId: string,
    @Req() request: AuthenticatedRequest
  ) {
    return this.blogService.getMine(request.sellerContext!.sellerId, postId);
  }

  @Patch(":postId")
  @UseGuards(SellerBlogGuard)
  update(
    @Param("postId", new ParseUUIDPipe({ version: "4" })) postId: string,
    @Body() body: UpdateBlogPostDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.blogService.update(request.sellerContext!.sellerId, postId, body);
  }

  @Get(":slug")
  get(@Param("slug") slug: string) {
    return this.blogService.getPublic(slug);
  }
}
