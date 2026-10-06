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
- **Communicate with the project owner in Arabic.** The owner does not read English:
  every chat reply, question, phase summary and decision request is written in
  Arabic. Owner-facing documents live in `docs/ar/` (Arabic); code, comments,
  commits and technical docs stay in English as per the language rules below.
  Each phase ends with an Arabic summary in `docs/ar/PHASE-<n>.md`.

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
    src/components/    AppShell (sidebar / mobile drawer), Seal, Badges, PreviewBanner
    src/features/      secretariat/, syndic/ screens (demo data until Phase 4 wires the API)
    src/demo/          data.json (fictional, Arabic) + typed loader
    SBA_PREVIEW=1      static export for the GitHub Pages preview (.github/workflows/pages.yml)
packages/
  shared/              Domain constants, state machines, i18n, shared types. Built to dist/ (ESM).
    locales/ar.json    THE single source of user-facing Arabic text (incl. notification templates)
  crypto/              AES-256-GCM seal/open, KeyRing (rotation), Pepper (HMAC). Server-only.
  db/                  Database package
    prisma/migrations/ SQL migrations — the source of truth for the schema
    prisma/schema.prisma  Client model, mirrors the SQL (CI fails on drift)
    src/seed/          Idempotent, transactional seed
    tests/             unit/, integration/ and constraints.checks.sql
docs/
  ARCHITECTURE.md      Tiers, trust boundaries, request data flow, roadmap
  DATABASE.md          Schema design, decisions D1–D17, implementation notes
  ar/                  Owner-facing documents in Arabic (decisions, phase summaries)
scripts/               generate-dev-secrets.mjs
infra/
  postgres/init/       First-start scripts: extensions, sba_app runtime role
  minio/               Bucket + least-privilege service account bootstrap
  secrets/             Git-ignored key material (see README there)
```

## Commands

```sh
pnpm install
cp .env.example .env            # then replace every CHANGE_ME
pnpm secrets:dev                # dev key material in infra/secrets/ (never overwrites)
pnpm infra:up                   # Postgres, Redis, MinIO, Mailpit (add --profile jitsi for Jitsi)
pnpm db:migrate && pnpm db:seed
pnpm dev                        # shared (watch) + api :4000 + web :3000
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm format:check
```

Database checks (need a migrated database with no demo data yet):

```sh
psql -v ON_ERROR_STOP=1 -f packages/db/tests/constraints.checks.sql   # rolled back afterwards
pnpm db:test                                                          # integration tests
pnpm --filter @sba/db drift                                           # Prisma schema == migrations
```

## Conventions

- **Naming:** DB `snake_case` (tables plural); TS `camelCase`/`PascalCase`; enum values
  `SCREAMING_SNAKE_CASE`, identical in DB, TS and API payloads.
- **API:** all routes under `/api/v1`. Mutating endpoints require an `Idempotency-Key` header.
- **IDs:** UUID primary keys; human-facing reference codes are separate columns.
- **Imports:** ESM with explicit `.js` extensions in `apps/api` and `packages/shared`.
- **UI design system:** tokens and component classes (`card`, `hero`, `stat-card`, `btn-*`,
  `input`, `badge`, `nav-item`, `dialog`) live in `apps/web/src/app/globals.css`; reuse
  them rather than ad-hoc colours. Gold is for accents, never body text on white.
  Numbers display in Eastern Arabic digits (`formatNumber`, and `t()` formats numeric params).
- **Errors to users:** Arabic message from `ar.json` + stable English error code; never
  leak stack traces or internal identifiers.
- **Commits:** English, imperative mood, scoped (`api: add queue endpoint`).
- **Secrets:** only via `*_FILE` env vars pointing into a secret mount; `.env` is git-ignored.
- **Schema changes:** new SQL migration first, then update `schema.prisma` until
  `drift` is empty. New tables holding legal records must `REVOKE DELETE` from `sba_app`.
- **Prisma partial uniques:** fields marked `PARTIAL UNIQUE` in `schema.prisma` must
  never be used in `findUnique`/`upsert`/`connect`; use `findFirst` with the predicate.
- **Connections:** the API uses `DATABASE_URL` (`sba_app`, DML only); migrations and
  the seed use `DATABASE_MIGRATION_URL` (owner).
