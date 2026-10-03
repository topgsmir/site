# Resolving payment attempts

Legacy `POST /orders` and standalone `POST /payments/:providerCode` support standalone Bridge orders only. Other products use checkout so shipping and service requirements are enforced.

Pending orders cannot be cancelled or manually completed while a payment attempt is active or ambiguous. Initiation atomically checks every allocated order before contacting a gateway. A provider-confirmed payment received for an already changed order stays unresolved, with its reference and verification time recorded and `PAYMENT_RECEIVED_REVIEW_REQUIRED` shown in the admin transaction list. It must not trigger fulfillment.

## Operator procedure

1. Find the attempt in the owner payment transaction list (`GET /payments/admin/transactions`). `RECONCILIATION_REQUIRED` means the provider outcome remains ambiguous. `PAYMENT_RECEIVED_REVIEW_REQUIRED` means money was received for an order that could not settle.
2. For an attempt that reached the provider, obtain a provider-side cancellation confirming the payment session cannot subsequently charge, or complete a refund of captured money through the provider. A browser failure, elapsed reservation, or customer statement is insufficient.
3. For provider-started attempts, wait at least 30 minutes after initiation began. Then call the owner-only, origin-protected `POST /payments/admin/:attemptId/resolve` with an `Idempotency-Key` UUID and JSON `{ "outcome": "cancelled", "providerEvidence": "provider support ticket/reference", "confirm": true }`. Use `refunded` after a confirmed refund. A captured late payment requires `refunded`. Evidence must be 10 to 500 characters; include the provider case/reference rather than credentials or card data.
4. Resolution records the owner, outcome, evidence reference, and request hash in a durable event. Replaying the same key returns the same outcome. If an ambiguous initiation lost its provider authority, a confirmed refund closes the attempt as `failed` with `OPERATOR_CONFIRMED_REFUND`, a refund timestamp, and the audit evidence; the database does not allow a `refunded` state without an authority.
5. The checkout expiry worker then releases expired group inventory and any wallet contribution, provided no other attempt remains active. Review the attempt, group, wallet ledger, and inventory after the next worker tick. This endpoint records an already completed provider action; it does not submit a provider cancellation or refund.

A `created` attempt has not reached the provider: buyer cancellation closes it atomically, or the owner can resolve it as `cancelled` immediately to free the payment slot while keeping the order payable. Record the local attempt or incident reference in `providerEvidence` for this case; no provider confirmation or 30-minute wait is required. Refund resolution is rejected for unstarted attempts.

Do not resolve succeeded, refund-in-progress, or currently initiating attempts through this endpoint. Use the normal refund workflow where supported. A crashed initiation still in `initiating` needs operator investigation before changing its state. Existing legacy non-Bridge unpaid orders should be cancelled and recreated through checkout; existing active gateway attempts must be resolved first.

## Inquiry policy

Zibal official docs: https://help.zibal.ir/ipg/; the page embeds https://api.zibal.ir/static/helpdocs/ipg.json (retrieved on 2026-10-02 with PowerShell `Invoke-RestMethod`). Inquiry `result=100` only means the report was generated. Payment `status=1` means paid/verified; `2` paid/unverified; `3` user-cancelled; `15` refunded; `18` reversed. `-1` means waiting and `-2` internal error. Status `16` means refund in progress.

Only paid states proceed to amount-checked verification. Only cancelled/refunded/reversed reports with the matching amount let reconciliation close an unpaid attempt. Waiting, internal errors, refund-in-progress, card/payment failures (4 through 12 and 21), unknown states, and network failures retain the reservation for retry/operator review. Zibal verification result `201` is recovered through a fresh inquiry requiring paid/verified status and an exact amount match. No live payment was submitted while verifying this implementation.

Workers claim a reconciliation timestamp before network access and isolate per-attempt errors, preventing old unresolved attempts from starving newer work. Zarinpal non-success inquiry responses likewise remain ambiguous, rather than authorizing inventory release.
