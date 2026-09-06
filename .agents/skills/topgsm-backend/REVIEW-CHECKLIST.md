# TopGSM Backend Review Checklist

Use the applicable sections before completing a backend change. A checked item means it was verified, not merely considered.

## Trust boundaries

- [ ] Every endpoint/event is deliberately public or protected by authentication.
- [ ] Role and permission checks match the operation.
- [ ] Resource ownership is enforced with the database query/mutation.
- [ ] Seller/buyer identity comes from the verified actor, not request input.
- [ ] Cross-tenant reads, writes, errors, caches, logs, and socket events are prevented.
- [ ] Platform-admin exceptions are explicit and narrow.

## Input and output

- [ ] Every untrusted payload has a concrete runtime-validated DTO/schema.
- [ ] String, array, page, batch, and payload sizes are bounded.
- [ ] IDs, enums, currencies, URLs, and numeric ranges are validated.
- [ ] Output is mapped through an allowlist and excludes secrets/internal fields.
- [ ] Failures use correct HTTP/socket semantics and do not leak internals.

## Authentication and abuse resistance

- [ ] Token/cookie handling is centralized and uses vetted primitives.
- [ ] Cookie-authenticated mutations have CSRF or strict origin protections.
- [ ] Auth, money, webhook, upload, and expensive endpoints have suitable rate limits.
- [ ] Security-sensitive errors avoid account/resource enumeration.
- [ ] Logs and telemetry redact credentials, tokens, cookies, personal data, and payment secrets.

## Data integrity

- [ ] Multi-record invariants use a transaction.
- [ ] Uniqueness, foreign keys, ranges, and invariants are database-enforced where possible.
- [ ] State transitions are explicit, authorized, and atomic.
- [ ] Repeated and concurrent requests cannot duplicate fulfillment, payment, refund, or payout.
- [ ] IDs are collision-resistant and durable state is not process-local.
- [ ] Migration rollout, existing rows, locks, compatibility, and rollback were considered.

## Money and providers

- [ ] Monetary math avoids JavaScript floating point.
- [ ] Amount, currency, seller terms, and ownership come from authoritative records.
- [ ] Rounding and serialization rules are explicit and consistent.
- [ ] Provider references/idempotency keys are unique in the database.
- [ ] Webhooks verify signature, freshness, replay, merchant, amount, currency, and order.
- [ ] Redirect/client callback data cannot settle an order by itself.

## Performance and reliability

- [ ] List reads are paginated, capped, deterministically ordered, and indexed.
- [ ] Prisma queries use narrow `select` projections and avoid N+1 work.
- [ ] Hot query SQL and query plans were inspected when performance is material.
- [ ] External calls use timeouts and only safe bounded retries.
- [ ] Cache keys include tenant/security context and have a justified staleness policy.
- [ ] CPU-heavy, large, or fan-out work is kept off the request path.
- [ ] Notifications happen after commit; durable delivery uses an outbox/queue when required.

## Realtime

- [ ] Handshake and inbound events are authenticated and authorized.
- [ ] Rooms are scoped to verified users/sellers/admins; no private event is global.
- [ ] Inbound payloads and event rates are bounded.
- [ ] Disconnect/reconnect and horizontal scaling behavior are safe.

## Tests and evidence

- [ ] Success and invalid-input paths are tested.
- [ ] Missing auth, wrong role, and cross-tenant access are tested.
- [ ] Duplicate/replay, illegal transition, and concurrency paths are tested when relevant.
- [ ] Database constraints/transactions are covered by PostgreSQL integration tests.
- [ ] Provider behavior is covered by contract tests or signed fixtures.
- [ ] Type-check, lint, build, and focused tests were run or explicitly reported as unavailable.

## Finding format

Report credible issues in priority order:

```text
[severity] Short title — path:line
Impact: What can fail or be exploited.
Evidence: The concrete code path or behavior.
Fix: The smallest credible remediation.
Status: Confirmed, or risk requiring validation.
```

Do not report preference-only style differences as defects.
