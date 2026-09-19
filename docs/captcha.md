# Self-hosted CAPTCHA

This is a local proof of work challenge. The API creates a random, two-minute challenge in PostgreSQL. The browser finds a SHA-256 answer using Web Crypto. The API consumes the challenge atomically and checks the answer and action before a protected operation. No external CAPTCHA service or script is used. It raises the cost of automated requests, but does not prove a human is present; keep rate limits and other abuse controls.

No business route requires it yet. To enable it for a route:

1. Render `CaptchaWidget` from `apps/web/src/components/CaptchaWidget.tsx` with a fixed `action` and `onTokenChange`. Submit the returned token with the protected request. Clear the token after use and change `resetSignal` to obtain a fresh challenge after any failed submission.
2. Import `CaptchaModule` into the API feature module and inject `CaptchaService`. Add a runtime-validated `captchaToken` field to the request DTO. After the route's rate limit and before the protected operation, call `await captcha.verify(body.captchaToken, "login")`, using the same fixed action as the widget.
3. Apply the new migration before enabling a route. Challenge issuance at `POST /api/captcha/challenge` has a database-backed per-IP rate limit. Expired challenge rows are pruned in small batches during issuance.

Malformed tokens return 400. Incorrect, expired, already used, or wrong-action tokens return 403. A token is single-use even when the submitted answer is wrong.
