# Deployment

How to run the system outside a developer's machine. **Nothing here has been
deployed to a real server yet**, and a production deployment needs the owner's
explicit approval (hosting, domain, SMS provider and network placement are open
questions — see `docs/ar/DECISIONS.md`). The steps below are the runbook to
follow once they are decided.

## 1. What runs where

```
Internet ──TLS──▶ reverse proxy (Caddy / nginx)  :443
                     │  X-Forwarded-For / X-Forwarded-Proto
                     ▼
                  web  (next start)              127.0.0.1:3000
                     │  forwards /api/v1/* (same origin, decision I-2)
                     ▼
                  API  (node apps/api/dist/main.js) 127.0.0.1:4000
                     │  DATABASE_URL as sba_app (DML only)
                     ▼
                  PostgreSQL 16                  internal only
```

| Component     | Needed now | Notes                                                                                  |
| ------------- | ---------- | -------------------------------------------------------------------------------------- |
| PostgreSQL 16 | Yes        | Extensions `btree_gist`, `citext` (`infra/postgres/init/01-extensions.sql`)            |
| API (Node 22) | Yes        | Never exposed directly; only the web process calls it                                  |
| Web (Node 22) | Yes        | The only process the reverse proxy talks to                                            |
| Jitsi         | Optional   | `JITSI_PUBLIC_URL` set → remote meetings get a link; unset → remote meetings refused   |
| Redis, MinIO  | Not yet    | Reserved for notification workers and document storage (Phase 3); not used by the code |
| SMS gateway   | Not yet    | Notifications are queued in the database and not sent until Phase 3                    |

The GitHub Pages preview is a separate, static, demo-only build (`SBA_PREVIEW=1`)
with no server and no real data. It must never be pointed at real users.

## 2. Environments

| Environment | Data                                      | Purpose                                      |
| ----------- | ----------------------------------------- | -------------------------------------------- |
| Development | Demo seed allowed (`SEED_DEMO_DATA=true`) | Local work; `docker compose` services        |
| Staging     | Fictional data only                       | Rehearse upgrades and the restore drill      |
| Production  | Real data; `SEED_DEMO_DATA=false`         | Never build with `SBA_DEMO` or `SBA_PREVIEW` |

## 3. Secrets

All secrets are files referenced by `*_FILE` variables, owned by the service
account, mode `0400`, outside the repository and outside database backups.

| File               | Content                                     | Generate                          |
| ------------------ | ------------------------------------------- | --------------------------------- |
| `jwt-signing-key`  | ≥ 32 random bytes, base64                   | `openssl rand -base64 48`         |
| `master-keys.json` | `{"kek-prod-2026-01": "<base64 32 bytes>"}` | `openssl rand -base64 32` per key |
| `pii-hmac-pepper`  | 32 random bytes, base64                     | `openssl rand -base64 32`         |
| database passwords | owner role and `sba_app`                    | password manager                  |

`master-keys.json` and the pepper protect TOTP secrets and national IDs. Losing
them makes that data unreadable; leaking them exposes it. Keep an offline copy
(sealed, two-person access) separate from database backups.

Rotation: add a new key id to `master-keys.json`, set `MASTER_KEY_ACTIVE_ID` to
it, restart. Old ids must stay in the file while any data is sealed with them
(re-wrapping is a Phase 3 job). Rotating `jwt-signing-key` signs everyone out.

## 4. Configuration

API (see `.env.example` for every variable and its default):

| Variable                                                                                   | Production value                                     |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `NODE_ENV`                                                                                 | `production` (forces `COOKIE_SECURE=true`)           |
| `API_HOST` / `API_PORT`                                                                    | `127.0.0.1` / `4000`                                 |
| `CORS_ALLOWED_ORIGINS`                                                                     | the public origin, e.g. `https://booking.example.sy` |
| `PUBLIC_BASE_URL`                                                                          | the same origin (used in links sent to requesters)   |
| `DATABASE_URL`                                                                             | `postgresql://sba_app:…@db:5432/sba`                 |
| `TRUST_PROXY_HOPS`                                                                         | `2` (reverse proxy + web server)                     |
| `JWT_SIGNING_KEY_FILE`, `MASTER_KEYS_FILE`, `MASTER_KEY_ACTIVE_ID`, `PII_HMAC_PEPPER_FILE` | paths from §3                                        |
| `JITSI_PUBLIC_URL`                                                                         | the Bar's Jitsi, or unset                            |
| Rate limits, session TTLs                                                                  | defaults unless the owner decides otherwise          |

Web: `API_INTERNAL_URL=http://127.0.0.1:4000`, `NODE_ENV=production`. Do **not**
set `SBA_DEMO` or `SBA_PREVIEW`.

Migrations and the seed use `DATABASE_MIGRATION_URL` (the owner role); the
running API never gets the owner credentials.

## 5. First installation

```sh
# 1. Build (on a build machine or the server)
pnpm install --frozen-lockfile
pnpm build:deps && pnpm build

# 2. Database: create the database and the owner role, then
psql -f infra/postgres/init/01-extensions.sql "$DATABASE_MIGRATION_URL"
psql "$DATABASE_MIGRATION_URL" -c "CREATE ROLE sba_app LOGIN PASSWORD '…'"
pnpm db:migrate
SEED_DEMO_DATA=false pnpm --filter @sba/db seed       # reference data and templates only

# 3. First administrator (refuses if one already exists; audited)
pnpm --filter @sba/api admin:create --email it@bar.example --name "…" \
  --password-file /run/secrets/initial-admin-password
shred -u /run/secrets/initial-admin-password

# 4. Reception rooms (no admin screen yet — run as the owner role)
psql "$DATABASE_MIGRATION_URL" -c \
  "INSERT INTO rooms (code, name_ar, capacity) VALUES ('MAIN', '…', 12)"

# 5. Start the services (example systemd units below), then the reverse proxy
```

Staff and lawyer accounts are created by the administrator through the API
(`POST /api/v1/admin/users`, `/admin/lawyers`, role grants). **There is no
administration screen yet**; until there is, this is done with an HTTP client
from the internal network. Every new staff member enrols TOTP at first sign-in.
Hand initial passwords over in person (see `SECURITY.md`).

Example unit (`/etc/systemd/system/sba-api.service`):

```ini
[Service]
User=sba
WorkingDirectory=/opt/sba/apps/api
EnvironmentFile=/etc/sba/api.env
ExecStart=/usr/bin/node dist/main.js
Restart=on-failure
NoNewPrivileges=true
ProtectSystem=strict
PrivateTmp=true
```

The web unit is the same with `WorkingDirectory=/opt/sba/apps/web` and
`ExecStart=/usr/bin/node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3000`.

Reverse proxy (Caddy):

```
booking.example.sy {
  request_body { max_size 1MB }
  reverse_proxy 127.0.0.1:3000 {
    header_up X-Forwarded-Proto {scheme}
  }
}
```

Health check: `GET /api/v1/health` → `{"status":"ok"}`.

## 6. Backups and restore

**Backups** (nightly, and before every upgrade):

```sh
pg_dump -Fc "$DATABASE_MIGRATION_URL" | age -r <backup-public-key> > sba-$(date +%F).dump.age
```

- Encrypt before the file leaves the server; keep at least one copy off-site.
- Retention: 30 daily, 12 monthly (owner to confirm).
- Key files (§3) are **not** in the dump; back them up separately.
- Record the audit-chain head with each backup — this is also the planned
  external anchoring of the chain:
  `psql -Atc "SELECT last_id, encode(last_hash, 'hex') FROM audit_chain_head" "$DATABASE_MIGRATION_URL"`
  and store the output somewhere a database administrator cannot rewrite.

**Restore drill** (on staging, at least quarterly and before go-live — not yet performed):

1. `age -d … | pg_restore --clean --if-exists -d "$STAGING_MIGRATION_URL"`.
2. Start the API with the same key files.
3. `SELECT audit_verify_chain();` → `NULL` means the chain is intact.
4. Compare the chain head with the value recorded at backup time.
5. Sign in as a test staff member; open the queue and the agenda.
6. Write down the time it took (recovery time) and the backup age (data loss window).

## 7. Upgrades and rollback

1. Take a backup (§6) and note the chain head.
2. Deploy the new build next to the old one.
3. `pnpm db:migrate`. Prisma records each applied migration. Not every migration
   file is wrapped in a single transaction, so a migration that fails part-way
   must be inspected before retrying — when in doubt, restore the backup from step 1.
4. Switch the services to the new build; check health and sign in.

Rollback:

- **Application only** (no new migration): start the previous build.
- **After a migration**: migrations are forward-only. If the previous build is
  incompatible with the new schema, restore the backup taken in step 1 (data
  written since then is lost — announce a maintenance window before upgrading).

## 8. Operations

- Logs: unexpected errors are logged with their `requestId`; the user sees the same id, so a report can be matched to the log line.
- Daily: `SELECT audit_verify_chain();` (alert if not `NULL`) and record the chain head.
- Watch: failed sign-ins and lockouts (`audit_logs.action` like `auth.%`), `QUEUED`
  notifications count (grows until Phase 3 workers exist), disk space for PostgreSQL.
- Rate limits are per API process; with more than one API instance, put
  equivalent limits on the reverse proxy.

## 9. Go-live checklist

- [ ] Owner decisions: hosting (Q-A2), staff network placement (Q-A1), SMS gateway (Q-A3), CAPTCHA (Q-A4), lawyer registry source.
- [ ] TLS certificate; HTTPS only; `COOKIE_SECURE=true`.
- [ ] `TRUST_PROXY_HOPS` matches the real proxy chain (check `actor_ip` in `audit_logs`).
- [ ] Secret files created, permissions `0400`, offline copy sealed.
- [ ] `pnpm audit --prod` clean; CI green on the release commit.
- [ ] Backup job running; restore drill done and timed.
- [ ] First administrator created; initial passwords handed over in person.
- [ ] Rooms configured; council members and Secretariat accounts created and enrolled.
- [ ] Requesters told that confirmations are not yet sent by SMS/e-mail (Phase 3) — the Secretariat contacts them by phone.
