# Security

What protects the system today, how each control is verified, and what is **not**
done yet. A control listed here without a test or a reproducible check is not
claimed. Using a security library is not counted as a control on its own.

Status: ✅ implemented and tested · 🟡 partial · ❌ not implemented

## 1. Assets and threats

| Asset                                         | Main threats                                                                  |
| --------------------------------------------- | ----------------------------------------------------------------------------- |
| The Grand Syndic's agenda and private entries | Disclosure of availability or private meetings; unauthorised bookings         |
| Requests and grievances (personal data)       | Disclosure to other requesters (IDOR); tampering; bulk scraping               |
| Decisions and their history                   | Silent alteration or deletion of the record                                   |
| Staff accounts                                | Credential stuffing, phishing, session theft, privilege retention after leave |
| Encryption keys, TOTP secrets, national IDs   | Theft from the database, backups or the repository                            |

## 2. Controls

### Authentication and sessions

| Control                                                                                                                      | Status | Evidence                                                    |
| ---------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------- |
| Passwords hashed with Argon2id; minimum 12 characters for new passwords                                                      | ✅     | `auth.service.ts`; `changePasswordSchema`                   |
| Same generic error for unknown account and wrong password; dummy hash keeps timing similar                                   | ✅     | `auth.e2e.ts` "rejects a wrong password and an unknown…"    |
| Lockout after 5 failures for 15 minutes (configurable), audited                                                              | ✅     | `auth.e2e.ts` "locks the account after 5 failures"          |
| Staff must use TOTP; a staff session without MFA can only reach enrolment                                                    | ✅     | `auth.e2e.ts` "confines staff without MFA to enrolment"     |
| TOTP codes cannot be replayed (last accepted step stored)                                                                    | ✅     | `auth.e2e.ts` "refuses the same code again (replay)"        |
| TOTP secrets stored encrypted (AES-256-GCM, bound to the user id)                                                            | ✅     | `auth.e2e.ts` checks the stored secret is not the plaintext |
| Lawyers and staff use separate doors; a lawyer cannot sign in through the staff door                                         | ✅     | `auth.e2e.ts` "keeps the two doors apart"                   |
| Access token: 10-minute JWT in an `HttpOnly; SameSite=Strict` cookie; signature, issuer, audience and type checked           | ✅     | `auth.e2e.ts` "forged tokens"                               |
| Refresh token: opaque, stored as SHA-256 only, rotated on every use; replaying an old one revokes the whole session          | ✅     | `auth.e2e.ts` "rotates refresh tokens and revokes…"         |
| Refresh cookie sent only to `/api/v1/auth`                                                                                   | ✅     | `cookies.ts`; browser check in `TESTING.md`                 |
| Idle (12 h) and absolute (7 days) session limits                                                                             | ✅     | `auth.service.ts` (`SESSION_*_TTL_SECONDS`)                 |
| Password change revokes the user's other sessions                                                                            | ✅     | `auth.service.ts`                                           |
| First admin created only by the `admin:create` CLI, which refuses when an active admin exists                                | ✅     | Run manually (see `TESTING.md` §4)                          |
| Weakness: whoever knows a new staff member's initial password can enrol MFA first. Mitigation: hand over passwords in person | 🟡     | Procedure, not code                                         |

### Authorisation

| Control                                                                                                             | Status | Evidence                                                    |
| ------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------- |
| Deny by default: every route needs a session unless marked `@Public()`; roles checked by a global guard             | ✅     | `auth.guard.ts`; 403 tests in `domain.e2e.ts`               |
| Roles re-read from the database on every request — revocation is immediate                                          | ✅     | `domain.e2e.ts` "loses access on the very next request"     |
| A lawyer sees only their own tickets; staff routes refuse lawyers whatever the id (no IDOR)                         | ✅     | `domain.e2e.ts` "refuses lawyers on the public form…"       |
| Branch and committee staff see only matters delegated to their own unit; others get 404 (no existence leak)         | ✅     | `domain.e2e.ts` "shows a delegated matter only to its own…" |
| Council members see only their own agenda and transfers                                                             | ✅     | `domain.e2e.ts` transfer tests                              |
| The Grand Syndic's private entries reach the Secretariat masked (name, place, link withheld by the API, not the UI) | ✅     | `domain.e2e.ts` "masks the Grand Syndic's private entries"  |
| Public endpoints never return availability; reschedule links record a wish and show no times                        | ✅     | `domain.e2e.ts`, `e2e/tests/flows.spec.ts`                  |
| The browser gate (`RequireSession`) is convenience only; the API decides                                            | ✅     | By design                                                   |
| System administrators manage accounts but have no route to case content                                             | ✅     | `admin.controller.ts` routes                                |

### Requests from the browser

| Control                                                                                                       | Status | Evidence                                                 |
| ------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| Same origin: the web server forwards `/api/v1/*` to the API; CSP keeps `connect-src 'self'`                   | ✅     | `apps/web/src/proxy.ts`; browser tests run through it    |
| CSRF: `SameSite=Strict` + double-submit token (`sba_csrf` cookie ↔ `X-CSRF-Token`) + Origin allowlist         | ✅     | `auth.e2e.ts` CSRF and cross-origin tests                |
| `Idempotency-Key` required on mutations; replay returns the stored answer; a reused key with another body→422 | ✅     | `domain.e2e.ts` idempotency test                         |
| zod validation of every body and query; errors list field paths only, never values                            | ✅     | `domain.e2e.ts` "rejects invalid input with field paths" |
| Error envelope `{code, message (Arabic), requestId}`; no stack traces or internal ids                         | ✅     | `error.filter.ts`; `foundation.e2e.ts`                   |
| Rate limits: global, sign-in, public submission                                                               | 🟡     | Per-process memory: not shared between API instances     |
| Web: per-request CSP nonce, `strict-dynamic`, `frame-ancestors 'none'`, HSTS, no referrer                     | ✅     | `proxy.ts`, `next.config.ts`                             |
| API: helmet with `default-src 'none'`, `X-Frame-Options: DENY`, HSTS, 64 KB body limit                        | ✅     | `app.setup.ts`                                           |
| Open redirect after sign-in prevented (`next` must be a same-site path)                                       | ✅     | `LoginForm.tsx` `safeNext`                               |
| Reschedule token travels in the URL fragment and is removed from the address bar                              | ✅     | `flows.spec.ts` asserts the URL no longer carries it     |
| CAPTCHA on the public form                                                                                    | ❌     | Open question Q-A4; rate limit only                      |

### Data integrity and record keeping

| Control                                                                                                | Status | Evidence                                             |
| ------------------------------------------------------------------------------------------------------ | ------ | ---------------------------------------------------- |
| No auto-confirmation: every request starts `PENDING_REVIEW` (service and DB trigger)                   | ✅     | `constraints.checks.sql`; browser and API tests      |
| State machines enforced in the service and by DB transition tables                                     | ✅     | `constraints.checks.sql`; `ILLEGAL_TRANSITION` tests |
| Double booking impossible: `EXCLUDE` constraints; concurrent approvals for one slot → exactly one wins | ✅     | `domain.e2e.ts` concurrency test                     |
| Every change writes its audit entry in the same transaction; the log is append-only and hash-chained   | ✅     | `domain.e2e.ts` audit chain verification             |
| Runtime role `sba_app` has DML only, cannot delete legal records or rewrite audit history              | ✅     | `packages/db/tests/integration`; API tests run as it |
| External anchoring of the audit-chain head (protects against a database superuser)                     | ❌     | Planned; see `DEPLOYMENT.md` §6                      |
| Notifications are written with the change (outbox), deduplicated by key                                | ✅     | `domain.e2e.ts`                                      |
| Notifications are actually sent (SMS / e-mail workers)                                                 | ❌     | Rows stay `QUEUED`; Phase 3                          |
| Documents: upload, in-memory encryption, malware scan, 5-minute viewing links                          | ❌     | Phase 3. The UI says so; no fake upload is offered   |

### Secrets and keys

| Control                                                                                        | Status | Evidence                                                       |
| ---------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------- |
| Keys only from files named by `*_FILE` variables; never in the database or the repository      | ✅     | `config/env.ts`, `.gitignore` (`infra/secrets/*`)              |
| Configuration validated at start-up; production refuses `COOKIE_SECURE=false`                  | ✅     | `env.test.ts`                                                  |
| Master keys carry ids for rotation; national IDs stored as HMAC (lookup) + AES-256-GCM (value) | ✅     | `packages/crypto` tests                                        |
| Re-wrapping data under a new master key                                                        | ❌     | No encrypted documents yet; TOTP secrets/national IDs: Phase 3 |

### Dependencies

`pnpm audit --prod` was clean after the overrides in `pnpm-workspace.yaml`
(audit finding P0-2). Re-run it on every dependency change and before release.

## 3. Deployment requirements that security depends on

These are not enforced by code; the deployment must provide them (see `DEPLOYMENT.md`):

1. TLS everywhere public; `COOKIE_SECURE=true`; HSTS reaches browsers only over HTTPS.
2. `TRUST_PROXY_HOPS` equal to the number of proxies in front of the API (reverse
   proxy + web server = 2), otherwise client IPs in the audit log and rate limits are wrong.
3. The API port is not reachable from outside; only the web server talks to it.
4. Secret files readable only by the service account (mode `0400`/`0600`).
5. Backups encrypted and stored apart from the key files.
6. Staff screens on the internal network or VPN (open question Q-A1).

## 4. Reporting a vulnerability

Report privately to the system owner (the Bar's IT officer). Do not open a public
issue. Include steps to reproduce; do not access data that is not yours.
