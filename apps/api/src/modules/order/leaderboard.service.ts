import { ForbiddenException, Injectable } from "@nestjs/common";
import type { AppUser } from "@topgsm/shared-types";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

type RankedBuyer = {
  buyer_id: string;
  full_name: string;
  place: bigint;
  score: bigint;
  spent: Prisma.Decimal;
  quantity: bigint;
  order_count: bigint;
};

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(actor: AppUser) {
    if (actor.role !== "buyer") throw new ForbiddenException("Buyer account required");

    const rows = await this.prisma.$queryRaw<RankedBuyer[]>(Prisma.sql`
      WITH purchased_orders AS (
        SELECT o.buyer_id,
               o.id,
               o.total_amount,
               SUM(oi.quantity)::bigint AS quantity
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        JOIN users u ON u.id = o.buyer_id AND u.role = 'buyer'
        WHERE o.status IN ('paid', 'processing', 'shipped', 'awaiting_confirmation', 'delivered')
          AND o.currency = 'TOMAN'
          AND NOT EXISTS (
            SELECT 1 FROM payment_attempts pa
            JOIN payment_refunds pr ON pr.payment_attempt_id = pa.id
            WHERE pa.order_id = o.id AND pr.status = 'succeeded'
          )
        GROUP BY o.buyer_id, o.id, o.total_amount
      ), buyer_totals AS (
        SELECT buyer_id, SUM(total_amount) AS spent,
               SUM(quantity)::bigint AS quantity,
               COUNT(*)::bigint AS order_count
        FROM purchased_orders
        GROUP BY buyer_id
      ), scored AS (
        SELECT buyer_id, spent, quantity, order_count,
               (FLOOR(spent / 1000) + quantity * 10)::bigint AS score
        FROM buyer_totals
      ), ranked AS (
        SELECT buyer_id, spent, quantity, order_count, score,
               ROW_NUMBER() OVER (ORDER BY score DESC, spent DESC, quantity DESC, buyer_id ASC) AS place
        FROM scored
      )
      SELECT ranked.buyer_id, users.full_name, spent, quantity, order_count, score, place
      FROM ranked JOIN users ON users.id = ranked.buyer_id
      WHERE place <= 20 OR ranked.buyer_id = ${actor.id}
      ORDER BY place ASC
    `);

    const publicEntry = (row: RankedBuyer) => ({
      place: Number(row.place),
      name: row.full_name.trim(),
      score: row.score.toString(),
      isYou: row.buyer_id === actor.id
    });
    const self = rows.find((row) => row.buyer_id === actor.id);
    return {
      currency: "TOMAN",
      leaders: rows.filter((row) => row.place <= 20n).map(publicEntry),
      you: self ? {
        ...publicEntry(self),
        spent: self.spent.toString(),
        quantity: Number(self.quantity),
        orderCount: Number(self.order_count)
      } : { place: null, name: actor.fullName, score: "0", spent: "0", quantity: 0, orderCount: 0, isYou: true }
    };
  }
}
