# Syrian Bar Association — Executive Governance & Smart Booking System

### نظام الحوكمة التنفيذية والحجز الذكي — نقابة المحامين في الجمهورية العربية السورية

A self-hosted, multi-tier portal for official audience requests, professional
grievances, the Grand Syndic's agenda, and encrypted legal documents.

- **Architecture:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (§9: as built)
- **Database design:** [`docs/DATABASE.md`](docs/DATABASE.md)
- **Security:** [`docs/SECURITY.md`](docs/SECURITY.md) · **Testing:** [`docs/TESTING.md`](docs/TESTING.md) · **Deployment:** [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
- **Audit and plan:** [`docs/AUDIT_REPORT.md`](docs/AUDIT_REPORT.md), [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)
- **Live demo preview (demo data only):** https://hussein199800.github.io/General-booking/
- **Owner-facing documents (Arabic):** [`docs/ar/`](docs/ar) — approved decisions, phase summaries
- **Contributor rules:** [`CLAUDE.md`](CLAUDE.md)

## Quick start

Requirements: Node.js ≥ 22.12, pnpm 10, Docker with Compose v2.

```sh
pnpm install
cp .env.example .env          # replace every CHANGE_ME value
pnpm secrets:dev              # dev key material in infra/secrets/
pnpm infra:up                 # Postgres 16, Redis 7, MinIO, Mailpit
pnpm db:migrate && pnpm db:seed
cp apps/api/.env.example apps/api/.env
pnpm --filter @sba/api build
pnpm --filter @sba/api admin:create --email you@example.org --name "Your Name" < password.txt
pnpm dev                      # API on :4000, web on :3000 (the web forwards /api/v1 to the API)
```

Sign in at http://localhost:3000/login; staff enrol a TOTP authenticator at first
sign-in. `SBA_DEMO=1 pnpm --filter @sba/web dev` runs the screens on browser-only
demo data instead (never in production).

| Service       | URL                                 |
| ------------- | ----------------------------------- |
| Web           | http://localhost:3000               |
| API health    | http://127.0.0.1:4000/api/v1/health |
| MinIO console | http://127.0.0.1:9001               |
| Mailpit       | http://127.0.0.1:8025               |

Optional self-hosted video meetings: `docker compose --profile jitsi up -d`.

## Quality gates

```sh
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm format:check
# with a PostgreSQL superuser URL (each run creates and drops its own database):
TEST_DATABASE_ADMIN_URL=postgresql://postgres:postgres@localhost:5432/postgres pnpm --filter @sba/api test:e2e
TEST_DATABASE_ADMIN_URL=postgresql://postgres:postgres@localhost:5432/postgres pnpm test:browser
```

Latest results are in [`docs/TESTING.md`](docs/TESTING.md).

## Status

| Area                                                                                  | State                                                             |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Database schema, constraints, audit chain                                             | Done, tested                                                      |
| API: auth (TOTP, lockout, sessions), RBAC, audit, idempotency                         | Done, tested                                                      |
| Requests, grievances, Secretariat decisions, delegation                               | Done, tested                                                      |
| Agenda: calendar, own entries, transfers, live tracking, emergency postponement       | Done, tested                                                      |
| Screens: public form, lawyer portal, Secretariat, Grand Syndic, members, branch inbox | Done, tested in a browser                                         |
| Administration screen                                                                 | Not started — API and CLI only                                    |
| Notification sending (SMS / e-mail)                                                   | Not started — messages are queued, not sent                       |
| Encrypted document storage                                                            | Not started                                                       |
| Production deployment                                                                 | Not done — runbook in `docs/DEPLOYMENT.md`, needs owner decisions |
