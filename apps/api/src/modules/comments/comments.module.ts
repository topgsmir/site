import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthModule } from "../auth/auth.module";
import { CommentsController, AdminCommentsController } from "./comments.controller";
import { CommentsService } from "./comments.service";
import { SellerCommentLockGuard } from "./seller-comment-lock.guard";

@Module({
  imports: [AuthModule],
  controllers: [CommentsController, AdminCommentsController],
  providers: [CommentsService, SellerCommentLockGuard, { provide: APP_GUARD, useExisting: SellerCommentLockGuard }],
  exports: [CommentsService]
})
export class CommentsModule {}
