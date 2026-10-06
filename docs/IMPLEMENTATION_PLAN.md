# Implementation plan

Derived from [`AUDIT_REPORT.md`](AUDIT_REPORT.md). Batches are ordered by priority
(P0 → P3) and dependency; each lists its acceptance criteria. A batch is done only
when its criteria are demonstrated by tests or by running the system.

Status legend: ☐ to do · ◐ in progress · ☑ done (with evidence in TESTING.md)

## Decisions

| #   | Decision                                                                                                                                                                                  | Why                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| I-1 | Keep the stack (NestJS, Prisma, PostgreSQL, Next.js). No new databases or services for v1.                                                                                                | It fits; the DB layer is already proven.                                                                |
| I-2 | **Browser → Next.js → API through a same-origin rewrite** (`/api/v1/*`). Sessions in `HttpOnly; Secure; SameSite=Strict` cookies, never in JS-readable storage.                           | Same origin keeps CSP `connect-src 'self'`, avoids CORS for the browser, and makes cookies first-party. |
| I-3 | CSRF: SameSite=Strict **plus** double-submit token (`sba_csrf` cookie + `X-CSRF-Token` header) on every cookie-authenticated mutation, **plus** Origin allowlist check.                   | Defence in depth; SameSite alone is not enough for older clients.                                       |
| I-4 | Access token: 10-minute JWT (HS256, key from file). Refresh: opaque random token, SHA-256 stored, rotated on every use, replay revokes the session (tables `sessions`, `refresh_tokens`). | Matches the schema built in Phase 1.                                                                    |
| I-5 | Roles are **re-read from `user_roles` on every request**, not trusted from the token.                                                                                                     | Revocation takes effect immediately.                                                                    |
| I-6 | Staff roles need TOTP. First login of a staff user without MFA can only reach the enrolment endpoints.                                                                                    | Hard rule 2; avoids a window where MFA-less staff act.                                                  |
| I-7 | Every mutation runs in one DB transaction that also writes its audit entry and outbox notifications.                                                                                      | Audit and notifications can never diverge from the data.                                                |
| I-8 | Demo data only when built with `SBA_PREVIEW=1` (GitHub Pages) or `SBA_DEMO=1` (local demos). Real builds use the API exclusively.                                                         | Fixes P0-1; production never shows demo data.                                                           |
| I-9 | Deferred to Phase 3 (documented as **not implemented** in the UI, not hidden): document upload/encryption/scan/viewing, notification dispatch workers, Jitsi links, CSV/PDF export.       | Each needs infrastructure (MinIO, Redis, Jitsi) not yet run; better absent than fake.                   |

## Batches

### B0 · P0 fixes ☑

- **B0.1** Gate demo screens (I-8). _Accept:_ production build, `GET /secretariat` without a session → redirect to `/login`; no demo strings in the HTML. Preview build unchanged.
- **B0.2** Override vulnerable transitive deps. _Accept:_ `pnpm audit --prod` clean; migrate, drift, seed and DB tests still pass.
- **B0.3** Portable API `dev` script. _Accept:_ no shell operators in `package.json` scripts.

### B1 · API foundation (P1) ☑ — depends on B0

Prisma service (runtime role), secret-file config, request context (request id, IP, user agent), uniform error envelope `{ code, message(ar) }` without internals, zod validation pipe, audit writer bound to the transaction, idempotency interceptor, rate limiter.
_Accept:_ unit tests for error mapping and validation; e2e: unknown route → 404 envelope; DB constraint violations map to stable codes (`CONFLICT_SLOT`, `ILLEGAL_TRANSITION`); repeated mutation with the same `Idempotency-Key` returns the stored response; different body → 422.

### B2 · Authentication and RBAC (P1) ☑ — depends on B1

Staff login (e-mail + password + TOTP), lawyer login (registration number + national ID + password), TOTP enrolment, refresh rotation with replay detection, logout, `GET /me`, lockout after repeated failures, roles guard, CSRF (I-3).
_Accept (e2e):_ wrong password → generic error and counter increments; 5 failures → locked; staff without MFA cannot call protected routes; refresh rotation works and a replayed refresh token revokes the session; revoked role loses access on the next request; mutation without CSRF header → 403.

### B3 · Domain API (P1) ☑ — depends on B2

- Public: `POST /public/audience-requests` (rate-limited) → `PENDING_REVIEW`, unique reference code, acknowledgement in outbox.
- Lawyer: `POST /lawyer/grievances`, `POST /lawyer/audience-requests`, `GET /lawyer/me/tickets` (own only).
- Secretariat: queue with search, filters, sort, pagination; ticket detail; approve & schedule, delegate, request documents, decline, priority change.
- Agenda: day/week/month listing; Grand Syndic's own entries (create, edit, cancel); transfer (same/new time); schedule transfer (member or Secretariat); live tracking; emergency postpone of the rest of the day.
- Member: own agenda and pending transfers.
- Every action: role guard, validation, state-machine check in the service, audit entry, outbox notification where applicable, idempotency on mutations.
  _Accept (e2e):_ full flow intake → triage → approve → agenda → transfer → schedule → track → complete; two concurrent approvals for the same slot → exactly one succeeds; a lawyer cannot read another lawyer's ticket by id; private entries are masked for the Secretariat; audit chain verifies after the suite.

### B4 · Web wiring (P1/P2) ☑ — depends on B3

Same-origin proxy (I-2); real login (password, TOTP, enrolment); session refresh; Secretariat dashboard, agenda, Grand Syndic and member screens on the API; public request form; lawyer portal (sign-in, grievance, audience request, my tickets); loading, empty and error states; Arabic error messages from API codes; print stylesheet.
_Accept:_ browser e2e against the real API: sign in, approve a request, see it on the Grand Syndic's agenda; public form submission returns a reference number; network failure shows an error state, not stale success.

### B5 · Documentation and hand-over (P2) ☑

`SECURITY.md`, `TESTING.md`, `DEPLOYMENT.md` (environments, secrets, backups and restore drill, rollback), updated `ARCHITECTURE.md`, `README.md`, Arabic summary `docs/ar/PHASE-2.md`.

### Phase 3 (not in this cycle)

Document storage (MinIO, envelope encryption, malware scan, 5-minute session-bound view URLs); BullMQ notification workers with SMTP / local SMS adapters and retries; Jitsi meeting links; reports (delay, processing time) and export; external anchoring of the audit-chain head; backup automation.

## Outcome of this cycle

All batches B0–B5 are done; evidence is in [`TESTING.md`](TESTING.md). Decisions
taken during implementation (small, reversible; recorded here as asked):

| #    | Decision                                                                          | Why                                                                         |
| ---- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| I-10 | Emergency postponement runs in one transaction instead of a worker job            | No workers yet; one day's audiences is a small set; all-or-nothing is safer |
| I-11 | Reschedule token in the URL fragment                                              | Fragments are not sent to servers, so tokens stay out of access logs        |
| I-12 | `DAY_SUSPENDED` error code for bookings on a suspended day                        | The DB trigger alone gave a generic, misleading message                     |
| I-13 | Agenda days created with `INSERT … ON CONFLICT DO NOTHING`                        | Two first bookings of a day raced on the day row instead of the slot        |
| I-14 | Secretariat officers may read the summary figures (`/reports/summary`)            | The dashboard counters need them; figures only, no personal data            |
| I-15 | Approvals and transfer bookings must start in the future                          | A past start is a typing error, never a booking                             |
| I-16 | First administrator via `admin:create` CLI only                                   | No default credentials anywhere                                             |
| I-17 | Browser tests live in their own workspace package (`e2e/`) and run the built apps | Tests what is deployed, not the dev server                                  |

## Next (needs owner approval or Phase 3)

1. Administration screen (accounts, roles, rooms) — today API-only.
2. Notification workers (SMTP, local SMS gateway) with retries — needs the SMS provider decision.
3. Encrypted document storage (MinIO) with malware scanning and short-lived viewing links.
4. Self-hosted CAPTCHA on the public form (Q-A4).
5. Reports and CSV/PDF export; print layouts for the daily agenda.
6. Deployment to the chosen server, restore drill, external anchoring of the audit-chain head.
