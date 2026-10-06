# Syrian Bar Association — Executive Governance & Smart Booking System

### نظام الحوكمة التنفيذية والحجز الذكي — نقابة المحامين في الجمهورية العربية السورية

A self-hosted, multi-tier portal for official audience requests, professional
grievances, the Grand Syndic's agenda, and encrypted legal documents.

- **Architecture:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **Database design (Phase 1, in review):** [`docs/DATABASE.md`](docs/DATABASE.md)
- **Contributor rules:** [`CLAUDE.md`](CLAUDE.md)

## Quick start

Requirements: Node.js ≥ 22.12, pnpm 10, Docker with Compose v2.

```sh
pnpm install
cp .env.example .env          # replace every CHANGE_ME value
pnpm infra:up                 # Postgres 16, Redis 7, MinIO, Mailpit
cp apps/api/.env.example apps/api/.env
pnpm dev                      # API on :4000, web on :3000
```

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
```

## Status

| Phase | Scope                             | State                                |
| ----- | --------------------------------- | ------------------------------------ |
| 0     | Plan & scaffold                   | Done                                 |
| 1     | Database schema, migrations, seed | Design drafted — **awaiting review** |
| 2     | Core API (Secretariat-first)      | Not started                          |
| 3     | Booking & crypto engine           | Not started                          |
| 4     | Frontends (Arabic RTL)            | Not started                          |
| 5     | Testing & hardening               | Not started                          |
