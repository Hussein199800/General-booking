# Audit report

**Date:** 2026-10-07 · **Commit audited:** `f1a6c1d` · **Auditor:** engineering lead (automated session)

Method: every claim below was checked against the code, by running the build and
test commands, or by exercising the running application. Nothing is taken from
the README alone. Evidence is given as file paths or the command that was run.

## 1. Executive summary

The repository is a well-structured TypeScript monorepo with a **strong, tested
database layer** and a **polished but disconnected front end**. The API that
should join them **does not exist yet**: it serves only `GET /api/v1/health`.
Every staff screen runs on a browser-only demo store.

The most serious finding is **P0-1**: the production (server) build of the web app
serves the Secretariat, Grand Syndic and council-member screens to anyone, without
sign-in, populated with demo data. It is not exploitable for real data (there is
none behind it) but it violates the rule that production must never present demo
data or imply unfinished features work, and it must be closed before any real
deployment.

## 2. Baseline (commands run at audit time)

| Check                                        | Command                                    | Result                                            |
| -------------------------------------------- | ------------------------------------------ | ------------------------------------------------- |
| Working tree                                 | `git status --short`                       | clean                                             |
| Formatting                                   | `pnpm format:check`                        | pass                                              |
| Lint (incl. no-Arabic-literal and RTL rules) | `pnpm lint`                                | pass                                              |
| Type check (strict TS 6)                     | `pnpm typecheck`                           | pass                                              |
| Unit tests                                   | `pnpm test`                                | 61 pass (crypto 11, shared 24, api 3, db 23)      |
| Build (all packages, server web build)       | `pnpm build`                               | pass                                              |
| DB integration tests                         | `pnpm db:test` (PostgreSQL 16)             | 9 pass                                            |
| SQL constraint checks                        | `packages/db/tests/constraints.checks.sql` | 56 pass                                           |
| Schema drift                                 | `pnpm --filter @sba/db drift`              | none                                              |
| CI on GitHub (last push)                     | Actions: CI + Pages                        | success                                           |
| Dependency audit                             | `pnpm audit --prod`                        | **2 high, 1 moderate** (see P0-2)                 |
| Compose file                                 | `docker compose config -q`                 | valid; **never run** (no Docker daemon available) |

## 3. Feature inventory

Legend: ✅ complete & verified · 🟡 partial · 🎭 UI only (demo data, no backend) ·
❌ broken/incorrect · ⬜ absent · ❔ cannot be verified here

| Area          | Feature                                                       | Status | Evidence                                                             |
| ------------- | ------------------------------------------------------------- | ------ | -------------------------------------------------------------------- |
| Database      | Schema, enums, FKs, indexes (27 tables)                       | ✅     | `packages/db/prisma/migrations/*`, drift check clean                 |
| Database      | No auto-confirmation (insert must be `PENDING_REVIEW`)        | ✅     | trigger `tickets_lifecycle`; checks §1                               |
| Database      | Ticket / appointment state machines                           | ✅     | transition tables + triggers; parity test vs `@sba/shared`           |
| Database      | Double-booking prevention (principal, room, attendee)         | ✅     | 3 `EXCLUDE` constraints; checks §2–3                                 |
| Database      | Principal-owned entries, transfers, live-tracking columns     | ✅     | migrations `agenda_*`, `transfer_scheduling`; checks §4b–4c          |
| Database      | Append-only hash-chained audit log                            | ✅     | triggers + `audit_verify_chain()`; checks §6                         |
| Database      | Least-privilege runtime role `sba_app`                        | ✅     | migration `runtime_role`; integration test                           |
| Database      | Seed (17 units, 2 entities, 20 templates, demo users)         | ✅     | `packages/db/src/seed`; integration tests, CI seeds twice            |
| Crypto        | AES-256-GCM, key ring with rotation, HMAC pepper              | ✅     | `packages/crypto`; 11 tests                                          |
| API           | Process bootstrap, helmet, strict CORS, env validation        | ✅     | `apps/api/src/main.ts`, `config/env.ts`; verified by curl in Phase 0 |
| API           | Database access from the API                                  | ⬜     | no Prisma usage in `apps/api`                                        |
| API           | Authentication (staff, lawyer), sessions, MFA, lockout        | ⬜     | no auth module                                                       |
| API           | RBAC guards                                                   | ⬜     | none                                                                 |
| API           | Public audience-request intake                                | ⬜     | none                                                                 |
| API           | Lawyer grievances and "my tickets"                            | ⬜     | none                                                                 |
| API           | Secretariat queue and actions                                 | ⬜     | none                                                                 |
| API           | Agenda, own entries, transfer, tracking, emergency reschedule | ⬜     | none                                                                 |
| API           | Audit entries written by the application                      | ⬜     | none (DB supports it)                                                |
| API           | Idempotency keys                                              | ⬜     | table exists, unused                                                 |
| API           | Rate limiting / CAPTCHA                                       | ⬜     | none                                                                 |
| Documents     | Encrypted upload, malware scan, signed view URLs              | ⬜     | `@sba/crypto` primitives only; no MinIO client                       |
| Notifications | Outbox dispatch, SMS / e-mail adapters, retries               | ⬜     | templates seeded; no worker, no Redis client                         |
| Meetings      | Jitsi meeting-link provider                                   | ⬜     | compose service only                                                 |
| Web           | Design system, RTL, Arabic-only text, responsive layout       | ✅     | `globals.css`, ESLint rules; screenshots at 390 px and 1366 px       |
| Web           | Landing page                                                  | ✅     | static content                                                       |
| Web           | Staff login                                                   | 🎭     | form is `disabled`; links straight to dashboards                     |
| Web           | Secretariat dashboard and actions                             | 🎭     | `features/secretariat/*` → `demo/store.ts`                           |
| Web           | Grand Syndic agenda, calendar, live board, transfers          | 🎭     | `features/syndic/*` → `demo/store.ts`                                |
| Web           | Council member screen                                         | 🎭     | `features/member/*` → `demo/store.ts`                                |
| Web           | Public audience-request form                                  | ⬜     | no page                                                              |
| Web           | Lawyer portal (grievance, my tickets)                         | ⬜     | no page                                                              |
| Web           | Search, pagination, reports, export                           | ⬜     | queue has a priority filter only                                     |
| Web           | Print styles                                                  | ⬜     | none                                                                 |
| Security      | Per-request CSP nonce, HSTS, frame denial (server build)      | ✅     | `src/proxy.ts`, `next.config.ts`; verified in Phase 0                |
| Security      | Staff screens protected in production build                   | ❌     | **P0-1**                                                             |
| Infra         | Docker Compose (Postgres, Redis, MinIO, Mailpit, Jitsi)       | ❔     | config validates; never started (no Docker daemon)                   |
| Infra         | Backups and restore                                           | ⬜     | undocumented, untested                                               |
| Deploy        | GitHub Pages static preview                                   | ✅     | `.github/workflows/pages.yml`; runs green                            |
| Deploy        | Real (on-premise) deployment                                  | ⬜     | no Dockerfiles, no runbook                                           |

## 4. Findings

### P0 — security, data loss, operability

**P0-1 · Staff screens served without authentication in the production build.**
`next build` (no `SBA_PREVIEW`) and `next start`, then
`curl -o /dev/null -w '%{http_code}' :3011/secretariat` → `200` (same for `/syndic`,
`/member`, `/secretariat/agenda`); the HTML contains the demo banner and demo
records. Cause: the pages import `demo/store.ts` unconditionally.
**Fix:** demo data only in preview/demo builds; in real builds the pages require a
session and read from the API.

**P0-2 · Vulnerable transitive dependencies.** `pnpm audit --prod`: `deepmerge-ts <8`
(high, stack exhaustion), `mysql2 <3.22` (high) and `<=3.23.0` (moderate), all via
`@prisma/client → prisma`. They sit in Prisma's CLI (MySQL driver, config merger)
and are not exercised by a PostgreSQL runtime, so practical risk is low, but the
production dependency tree must be clean. **Fix:** pnpm `overrides`, then re-verify
migrations, drift and seed.

**P0-3 · No backend: nothing the UI shows is persisted.** Every staff action is
written to `localStorage`. **Fix:** Phase 2 API (§ plan B2–B4) and web wiring (B5).

### P1 — core functionality gaps

- No authentication, sessions, MFA or RBAC (`apps/api` has no such modules).
- No public intake or lawyer portal pages.
- Audit log is never written by application code; idempotency table unused.
- Notification outbox rows are never created or dispatched.
- Document upload / encryption / viewing not implemented.

### P2 — quality and operability

- `apps/api` `dev` script uses POSIX `&` and a subshell; fails on Windows shells.
- Prisma `partialIndexes` exposes partial-unique columns in `findUnique`
  (documented footgun, `docs/DATABASE.md` §6) — must be respected in new code.
- Audit chain serialises writers on one row: acceptable for this workload; to be
  revisited if write volume grows.
- Docker Compose stack never actually started; Jitsi configuration unverified.
- No print stylesheet; no explicit empty/error states for network failures (there
  is no network yet).

### P3

- Reports (delay, processing time), export, advanced search.

## 5. Risks

| Risk                                          | Likelihood | Impact                               | Mitigation                                                              |
| --------------------------------------------- | ---------- | ------------------------------------ | ----------------------------------------------------------------------- |
| Demo screens deployed as if real (P0-1)       | Medium     | High (credibility, misleading users) | Gate by build mode; real pages require a session                        |
| Partial-unique misuse returns historical rows | Medium     | Medium                               | `PARTIAL UNIQUE` markers; code review; tests on transfer/approval paths |
| Superuser rewrites audit chain                | Low        | High                                 | Daily external anchoring of the chain head (documented, not built)      |
| Untested infrastructure (Compose, backups)    | High       | High at go-live                      | Deployment runbook and restore drill before production                  |
| Single-row audit chain contention             | Low        | Low                                  | Monitor; batch sealing if needed                                        |

## 6. Resolution (end of this cycle)

| Finding                                                             | Status                                                                               | Where                                                                                           |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| P0-1 demo screens served unauthenticated                            | Fixed — demo only in preview/demo builds; real pages need a session and read the API | `lib/runtime.ts`, `lib/session.tsx`, browser test "send a visitor without a session to sign in" |
| P0-2 vulnerable transitive dependencies                             | Fixed — `pnpm audit --prod` clean                                                    | `pnpm-workspace.yaml` overrides                                                                 |
| P0-3 no backend                                                     | Fixed — API with auth, RBAC, audit, idempotency; web wired to it                     | `apps/api`, `apps/web/src/data`                                                                 |
| P1 auth/RBAC, intake, lawyer portal, audit writes, outbox           | Fixed                                                                                | `SECURITY.md`                                                                                   |
| P1 documents                                                        | Open — Phase 3                                                                       |                                                                                                 |
| P2 dev script, empty/error states                                   | Fixed                                                                                | `apps/api/scripts/dev.mjs`, `ResourceStatus`                                                    |
| P2 Compose stack and Jitsi unverified, print stylesheet             | Open                                                                                 | `DEPLOYMENT.md`                                                                                 |
| P3 reports/export                                                   | Partial — summary figures only                                                       | `/reports/summary`                                                                              |
| New: CI lint failed on fresh checkouts (stale local `dist/` hid it) | Fixed                                                                                | `build:deps` builds `@sba/db`                                                                   |

## 7. What is solid and must be kept

The database design and its 56 constraint checks; the crypto package; the shared
state machines and i18n; the design system and RTL enforcement; the CI that
checks drift, constraints and seed idempotency. None of this needs rewriting.
