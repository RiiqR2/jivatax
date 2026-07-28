# Cookie authentication

Access (15 minutes by default) and rotating refresh (7 days) JWTs use separate secrets and HttpOnly cookies. Only Argon2id hashes of refresh tokens are persisted. A successful refresh revokes its session and links it to the replacement. Reuse of a cryptographically valid token for a revoked session revokes every active session for that user.

Unsafe API methods require an exact `Origin` match with `WEB_ORIGIN`; SameSite is additional protection, not a complete CSRF substitute. Deployments that need cross-site cookies must use `COOKIE_SAME_SITE=none` with `COOKIE_SECURE=true`. A dedicated CSRF token is recommended before supporting additional browser origins.

The current organization is stored on `auth_sessions`, never trusted from the token or a public environment variable, and is revalidated against active membership and organization state. Company routes additionally validate that the company belongs to the selected organization.
