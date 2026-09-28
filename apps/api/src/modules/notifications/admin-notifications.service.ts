import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export type AdminNotificationCounts = {
  comments: number;
  photos: number;
  products: number;
  articles: number;
  refunds: number;
  payouts: number;
};

@Injectable()
export class AdminNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async counts(): Promise<AdminNotificationCounts> {
    const [comments, photos, products, articles, refunds, payouts] = await Promise.all([
      this.prisma.comments.count({ where: { status: "pending" } }),
      this.prisma.media_deletion_requests.count({ where: { status: "pending" } }),
      this.prisma.products.count({ where: { status: "pending_review" } }),
      this.prisma.blog_posts.count({ where: { archived_at: null, working_revision: { status: "pending_review" } } }),
      this.prisma.bridge_fulfillments.count({ where: { status: "refund_requested" } }),
      this.prisma.payout_ledger.count({ where: { status: "requested" } })
    ]);
    return { comments, photos, products, articles, refunds, payouts };
  }
}
