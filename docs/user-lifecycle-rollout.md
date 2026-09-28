# Account lifecycle rollout and operations

## Behavior

The administrator user workspace exposes role changes, manual block/unblock, and
irreversible anonymized deletion in English, Persian and Arabic. Ordinary profile
updates cannot change roles. Every new mutation is owner-only, origin-protected,
rate-limited and included in the administrator AI catalog. Privileged role
transitions and deletion require the acting administrator's password and the
target's exact username, email, or fallback ID.

Role changes use serializable transactions and administration/user/seller locks;
they replace platform permissions and seller membership and revoke sessions.
Canonical seller owners cannot be demoted or moved through this workflow.
Blocked accounts retain their status after a role change. Blocking does not
suspend the seller or hide public content.

The existing database requirement that non-buyers have email remains in force.
Add an email before promoting a phone-only buyer or handing seller ownership to
that buyer. Replacement search excludes these accounts for seller handoffs.

Deletion first checks ownership and commercial obligations, then persists a job
and fences participating accounts/sellers. The source account becomes
`deletion_pending` and the source seller is suspended. Participating accounts and
sellers cannot be mutated by other operations until completion; destination
public content is not hidden. Buyer handoff preserves the seller and product
identities. A merge transfers operational ownership to an existing seller.

The destination wins duplicate listings and coupon codes. Conflicting source
listings are archived, duplicate coupons deactivated, and bridge listings archived
for manual reconfiguration. Bridge credentials, seller settings and permissions
are never copied. Completed order buyer/seller IDs, order-item offer IDs, payouts,
uploader/replier/flagger identities, and audit actors remain unchanged. A tightly
scoped database trigger exception permits the fenced worker to move operational
listings with historical orders without changing those orders or their payouts.

The worker claims with `FOR UPDATE SKIP LOCKED` and commits at most 200 root
records per batch, with an indexed keyset cursor and counts in the same
transaction. Each process can run a worker; no external queue or lease is needed.
Database cascading deletes of private AI conversations also remove their child
records. Public ownership, archived conflict states, handoff sizes and commercial
blockers are recounted before finalization. Only then are identifiers/passwords
cleared and the account marked `deleted`. Private AI conversations and phone
communications are removed and private profile snapshots are redacted. Immutable
financial/audit records are retained, not reassigned to the replacement.

## Deployment

1. Back up and verify recovery before enabling destructive account operations.
2. Run `pnpm run doctor` using Node 24.20.0 and pnpm 12.3.4, and generate Prisma.
3. Validate on a disposable local PostgreSQL database with:
   `pnpm --filter topgsm-api exec node scripts/test-user-lifecycle.mjs`.
   The runner requires localhost, creates a uniquely named test database and
   drops only that database on completion. It never migrates the configured
   application database.
4. Apply `20260927160000_user_lifecycle` and all ten following lifecycle index
   migrations before starting the new API. The initial DDL uses a five-second
   lock timeout; arrange a low-traffic window and investigate long transactions
   if it times out. It adds triggers and validates account constraints.
5. Indexes are separate single-statement concurrent migrations because Prisma's
   multi-statement execution cannot run `CREATE INDEX CONCURRENTLY`. Inspect
   `pg_index.indisvalid` after deployment. If a build fails, repair only that
   failed index/migration using the normal Prisma recovery procedure; do not
   silently mark unapplied migrations successful.
6. Deploy shared contracts, API and web together. Keep at least one API process
   running with `DISABLE_BACKGROUND_WORKERS` unset (or not `true`). Monitor queued,
   failed and long-running `user_deletion_jobs` and the safe worker failure code.
7. Test login, block/unblock, privileged confirmation and a small handoff in
   staging before enabling large merges. A deleted account cannot be restored by
   unblocking or editing it.

## Failure and recovery

A crash rolls back the current batch and releases its row lock. A new process
continues from the last committed cursor. Failure accounting uses PostgreSQL's
row version so it cannot overwrite another worker's newer success. Transient
batch failures stop after three attempts; count/ownership failures stop at once.
The account remains pending, the source seller suspended and all lifecycle locks
retained. Diagnose the safe error code, resolve the underlying cause, then use
the owner-only Retry action. Retry is forward-only and does not undo completed
transfers. Never manually delete lock rows to make a failed transfer writable.

Do not roll the application back to a version that ignores account status while
blocked, pending or deleted accounts exist. Roll forward with a fix. Reversing
an anonymized deletion or merge requires coordinated recovery from a verified
backup; reverting the schema alone does not restore data or ownership.

## Verification and existing findings

The lifecycle integration suite covers all 25 non-owner role pairs, owner/self
blockers, password and OTP rejection, HTTP authorization/origin/validation/rate
limits, administrator concurrency, competing worker claims, failed-transaction
rollback/retry, buyer handoff and a 10,000-product seller merge with conflicts and
historical order/payout assertions. Unit coverage also checks revoked sockets
receive no private events. Web checks are type-check and focused lint; an
interactive browser acceptance pass is still required before production rollout.

The plan's multiple-active-membership finding needs a correction: migration
`20260915160000_harden_database_invariants` already creates the partial unique
index `seller_memberships_one_active_per_user_key`. The integration test proves
it rejects a second active membership. Verify that index is deployed. Canonical
ownership of seller A combined with an active membership in seller B is still
possible in legacy data; replacement selection rejects that ambiguity, and role
changes cannot move canonical owners away from their seller.

An existing shared trigger referenced `NEW.listing_id` while executing on the
listing table, where that column does not exist. The new migration separates
table-specific branches and tests both ordinary rejected reparenting and the
authorized historical-listing merge. Existing sockets also previously retained
their handshake authorization until disconnect; private deliveries now recheck
the session, and revoked sockets are disconnected.
