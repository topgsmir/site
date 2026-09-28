import type { TransferCount, UserDeletionJob } from "@topgsm/shared-types";
import { Prisma, type user_deletion_jobs } from "../../prisma/client";

export type TransferContext = Pick<user_deletion_jobs, "user_id" | "replacement_user_id" | "source_seller_id" | "destination_seller_id" | "mode">;
export const TRANSFER_PHASES = ["products", "listings", "coupons", "articles", "articleMedia", "comments", "assignments", "privateAi", "profileHistory", "otp", "communications", "finalize"] as const;
export type TransferPhase = typeof TRANSFER_PHASES[number];
export function phaseQuery(phase: TransferPhase, job: TransferContext): { table: string; key: string; uuid: boolean; where: Prisma.Sql } {
  const merge = job.mode === "merge"; const source = job.source_seller_id;
  switch (phase) {
    case "products": return { table: "products", key: "id", uuid: true, where: Prisma.sql`created_by_seller_id = ${merge ? source : null}` };
    case "listings": return { table: "seller_listings", key: "id", uuid: true, where: Prisma.sql`seller_id = ${merge ? source : null}` };
    case "coupons": return { table: "coupons", key: "id", uuid: false, where: Prisma.sql`seller_id = ${merge ? source : null}` };
    case "articles": return { table: "blog_posts", key: "id", uuid: false, where: Prisma.sql`(creator_user_id = ${job.user_id} OR seller_id = ${merge ? source : null})` };
    case "articleMedia": return { table: "blog_media_assets", key: "id", uuid: false, where: Prisma.sql`(owner_user_id = ${job.user_id} OR seller_id = ${merge ? source : null})` };
    case "comments": return { table: "comments", key: "id", uuid: true, where: Prisma.sql`author_user_id = ${job.user_id}` };
    case "assignments": return { table: "comment_assignments", key: "comment_id", uuid: true, where: Prisma.sql`seller_id = ${merge ? source : null}` };
    case "privateAi": return { table: "ai_conversations", key: "id", uuid: false, where: Prisma.sql`owner_user_id = ${job.user_id}` };
    case "profileHistory": return { table: "admin_user_profile_changes", key: "id", uuid: true, where: Prisma.sql`user_id = ${job.user_id}` };
    case "otp": return { table: "otp_challenges", key: "id", uuid: false, where: Prisma.sql`phone_number = (SELECT phone_number FROM users WHERE id = ${job.user_id})` };
    case "communications": return { table: "sms_deliveries", key: "id", uuid: false, where: Prisma.sql`recipient = (SELECT phone_number FROM users WHERE id = ${job.user_id})` };
    default: throw new Error("Invalid transfer phase");
  }
}
export const emptyCount = (): TransferCount => ({ transferred: 0, archived: 0, skipped: 0, conflicted: 0 });
export function processed(count: TransferCount) { return count.transferred + count.archived + count.skipped; }
export function mapDeletionJob(job: user_deletion_jobs): UserDeletionJob {
  return { id: job.id, userId: job.user_id, replacementUserId: job.replacement_user_id,
    sourceSellerId: job.source_seller_id, destinationSellerId: job.destination_seller_id, conflictReport: job.conflict_report as Record<string, number>,
    status: job.status as UserDeletionJob["status"], phase: TRANSFER_PHASES[job.phase] ?? "finalize",
    expected: job.expected as Record<string, number>, progress: job.progress as unknown as Record<string, TransferCount>,
    errorCode: job.error_code, attempts: job.attempts, createdAt: job.created_at.toISOString(), completedAt: job.completed_at?.toISOString() ?? null };
}
