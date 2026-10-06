# CLAUDE.md — Syrian Bar Association Governance & Smart Booking System

## Purpose

A sovereign administrative portal for the Syrian Bar Association (نقابة المحامين في
الجمهورية العربية السورية). It receives and triages official audience requests,
routes professional grievances to the correct internal body, manages the Grand
Syndic's agenda under full human control by the Secretariat, coordinates with the
Ministry of Justice and the Supreme Judicial Council, and stores sensitive legal
documents encrypted.

**Priorities, in order: security → auditability → institutional formality → convenience.**

## Working agreement

- Work proceeds in **phases** (see `docs/ARCHITECTURE.md` §Roadmap). Finish a phase,
  summarise it, then **stop and wait for approval**. Never start the next phase unasked.
- **Never invent legal or institutional procedure.** If a workflow detail is unclear,
  ask; record open questions in the relevant doc.
- No placeholder logic presented as complete. If something is stubbed, say so in code
  and in the phase summary.

## Hard rules (non-negotiable)

1. **No auto-confirmation.** Every request is created `PENDING_REVIEW`; only a
   Secretariat human approves. Enforced in the service layer _and_ by a DB trigger.
2. **Never expose calendar availability publicly** — not in APIs, not in reschedule links.
3. **Files are never stored unencrypted**, not even temporarily on disk. Encrypt in
   memory (AES-256-GCM, per-file data key wrapped by a master key) before storage.
4. **Encryption keys never live in the database or the repo.** Load from files
   referenced by env vars (`*_FILE`); support multiple key ids for rotation.
5. **RBAC is enforced server-side on every endpoint.** The UI is never trusted.
6. **Every state change writes an audit log entry** (who, what, when, IP, before/after).
   `audit_logs` is append-only and hash-chained; never update or delete it.
7. **State machines are strict.** Illegal transitions are rejected in the service and
   again by the DB transition tables.
8. **Double-booking is prevented by PostgreSQL `EXCLUDE` constraints**, not by
   application checks alone.
9. **No hard dependency on Zoom, Teams, Twilio, AWS or Google.** Use the pluggable
   `MeetingProvider` (default: self-hosted Jitsi), `SmsProvider` (local gateway /
   console) and `EmailProvider` (SMTP) adapters.

## Language rules

| Layer                                                             | Language                          |
| ----------------------------------------------------------------- | --------------------------------- |
| UI, forms, notifications, SMS, e-mails, user-facing errors        | Professional Arabic (الفصحى), RTL |
| Code, DB schema, API routes, comments, commit messages, tech docs | English                           |

- All user-facing strings live in **`packages/shared/locales/ar.json`** and are read with
  `t('section.key', params)` from `@sba/shared`. **No Arabic literals in source files** —
  ESLint fails the build on any Arabic string, template or JSX text.
- Typography: `font-family: Calibri, -apple-system, "SF Arabic", "SF Pro", system-ui, sans-serif;`
  (defined once as `--font-sans` in `apps/web/src/app/globals.css`).
- RTL: `<html lang="ar" dir="rtl">`; use **logical** properties/utilities only
  (`ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-`/`text-start`/`border-s`). ESLint rejects
  physical-direction Tailwind classes (`ml-`, `pr-`, `left-`, `text-right` …).
- Timestamps are stored as `timestamptz` in UTC and displayed in `Asia/Damascus`
  (`formatDateTime()` in `@sba/shared`).

## Stack

| Concern        | Choice                                                                           |
| -------------- | -------------------------------------------------------------------------------- |
| Language       | TypeScript 6 (strict, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`)  |
| Backend        | NestJS 12 (ESM), guards for RBAC                                                 |
| Database       | PostgreSQL 16 + Prisma; raw SQL migrations for constraints Prisma cannot express |
| Queues / cache | Redis 7 + BullMQ                                                                 |
| Frontend       | Next.js 16 (App Router), React 19, Tailwind CSS 4                                |
| File storage   | MinIO (S3-compatible, self-hosted)                                               |
| Auth           | Argon2id, short-lived JWT access + rotating refresh tokens, TOTP MFA             |
| Validation     | zod (schemas shared between web forms and API DTOs)                              |
| Infra          | Docker Compose locally; everything self-hostable on-premise                      |

## Repository layout

```
apps/
  api/                 NestJS API (ESM). src/main.ts bootstraps helmet, CORS, /api/v1 prefix.
    src/config/        zod-validated environment (fails fast on bad config)
  web/                 Next.js App Router, Arabic RTL.
    src/proxy.ts       per-request CSP nonce (Next 16 "proxy", formerly middleware)
    src/i18n/          re-exports t() — the only way components get text
packages/
  shared/              Domain constants, i18n, shared types. Built to dist/ (ESM).
    locales/ar.json    THE single source of user-facing Arabic text
docs/
  ARCHITECTURE.md      Tiers, trust boundaries, request data flow, roadmap
  DATABASE.md          Schema design and rationale (Phase 1)
  database/            Executable schema draft + constraint checks
infra/
  postgres/init/       Extensions created on first DB start (btree_gist, citext)
  minio/               Bucket + least-privilege service account bootstrap
  secrets/             Git-ignored key material (see README there)
```

## Commands

```sh
pnpm install
cp .env.example .env            # then replace every CHANGE_ME
pnpm infra:up                   # Postgres, Redis, MinIO, Mailpit (add --profile jitsi for Jitsi)
pnpm dev                        # shared (watch) + api :4000 + web :3000
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm format:check
```

Schema draft checks (needs a scratch PostgreSQL 16 database):

```sh
psql -v ON_ERROR_STOP=1 -d <scratch_db> \
  -f docs/database/schema-draft.sql -f docs/database/schema-draft.checks.sql
```

## Conventions

- **Naming:** DB `snake_case` (tables plural); TS `camelCase`/`PascalCase`; enum values
  `SCREAMING_SNAKE_CASE`, identical in DB, TS and API payloads.
- **API:** all routes under `/api/v1`. Mutating endpoints require an `Idempotency-Key` header.
- **IDs:** UUID primary keys; human-facing reference codes are separate columns.
- **Imports:** ESM with explicit `.js` extensions in `apps/api` and `packages/shared`.
- **Errors to users:** Arabic message from `ar.json` + stable English error code; never
  leak stack traces or internal identifiers.
- **Commits:** English, imperative mood, scoped (`api: add queue endpoint`).
- **Secrets:** only via `*_FILE` env vars pointing into a secret mount; `.env` is git-ignored.
