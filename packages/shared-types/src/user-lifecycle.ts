export type AccountStatus = "active" | "blocked" | "deletion_pending" | "deleted";
export type ManagedUserRole = "buyer" | "seller_staff" | "seller_admin" | "platform_staff" | "platform_admin";
export interface LifecycleCandidate { id: string; label: string; sellerId: string | null; sellerName: string | null }
export interface UserRoleChangeRequirements {
  emailRequiredForNonBuyer: boolean;
  canonicalSellerId: string | null;
  confirmationRoles: ManagedUserRole[];
}
export interface UserAccessDetails {
  role: ManagedUserRole; status: AccountStatus; identifier: string;
  platformPermissions: string[];
  memberships: { sellerId: string; shopName: string; role: string; active: boolean; canonicalOwner: boolean }[];
  ownedSellerId: string | null;
  requirements: UserRoleChangeRequirements;
  job: UserDeletionJob | null;
}
export interface DeletionImpact {
  replacementLabel: string | null;
  counts: Record<string, number>; blockers: Record<string, number>;
  replacementRequired: boolean; sourceSellerId: string | null;
  destinationSellerId: string | null; mode: "content" | "handoff" | "merge";
  conflicts: Record<string, number>; identifier: string;
}
export interface TransferCount { transferred: number; archived: number; skipped: number; conflicted: number }
export interface UserDeletionJob {
  conflictReport: Record<string, number>;
  sourceSellerId: string | null;
  destinationSellerId: string | null;
  id: string; userId: string; replacementUserId: string | null;
  status: "queued" | "running" | "failed" | "completed"; phase: string;
  expected: Record<string, number>; progress: Record<string, TransferCount>;
  errorCode: string | null; attempts: number; createdAt: string; completedAt: string | null;
}
