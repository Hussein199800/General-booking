# Testing

Every suite below runs against real components: a real PostgreSQL database
created and migrated for the run, the API connected as the least-privilege
`sba_app` role, and — for browser tests — the built web app in a real Chromium.
Nothing is mocked except outbound delivery, which is not implemented yet.

## 1. Suites

| Suite              | Where                                      | What it proves                                                                                      | Command                                                               |
| ------------------ | ------------------------------------------ | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Unit — shared      | `packages/shared/src/**/*.test.ts`         | State machines, i18n (`t()`, Eastern Arabic digits), priorities                                     | `pnpm test`                                                           |
| Unit — crypto      | `packages/crypto`                          | AES-256-GCM seal/open, tamper detection, key ring rotation, HMAC pepper                             | `pnpm test`                                                           |
| Unit — db          | `packages/db/tests/unit`                   | Seed configuration and helpers                                                                      | `pnpm test`                                                           |
| Unit — api         | `apps/api/src/**/*.test.ts`                | Environment validation, database-error mapping                                                      | `pnpm test`                                                           |
| Schema constraints | `packages/db/tests/constraints.checks.sql` | 56 checks: state machines, EXCLUDE overlaps, audit chain tamper detection, runtime role limits      | `psql -v ON_ERROR_STOP=1 -f packages/db/tests/constraints.checks.sql` |
| Schema drift       | Prisma                                     | `schema.prisma` matches the SQL migrations exactly                                                  | `pnpm --filter @sba/db drift`                                         |
| DB integration     | `packages/db/tests/integration`            | Transitions and privileges through Prisma as `sba_app`, seed idempotency                            | `pnpm db:test`                                                        |
| API end-to-end     | `apps/api/test/*.e2e.ts`                   | Every endpoint family over HTTP: auth, RBAC, IDOR, CSRF, idempotency, concurrency, audit chain      | `TEST_DATABASE_ADMIN_URL=… pnpm --filter @sba/api test:e2e`           |
| Browser end-to-end | `e2e/tests/*.spec.ts`                      | The real web app on the real API: sign-in with TOTP, approval to agenda, error states, phone layout | `pnpm build && TEST_DATABASE_ADMIN_URL=… pnpm test:browser`           |

`TEST_DATABASE_ADMIN_URL` is an owner/superuser connection to a maintenance
database (for example `postgresql://postgres:postgres@localhost:5432/postgres`).
Each run creates its own database and drops it afterwards.

## 2. Results (run on 2026-10-06, branch `claude/new-session-25ky6n`)

| Suite                   | Result                                          |
| ----------------------- | ----------------------------------------------- |
| Unit (all packages)     | 70 passed — shared 24, crypto 11, db 23, api 12 |
| Schema constraints      | 56 / 56 passed ("ALL SCHEMA CHECKS PASSED")     |
| Schema drift            | No difference detected                          |
| DB integration          | 9 passed                                        |
| API end-to-end          | 33 passed (foundation 3, auth 12, domain 18)    |
| Browser end-to-end      | 11 passed (9 desktop, 2 phone viewport)         |
| `pnpm audit --prod`     | No known vulnerabilities found                  |
| Lint, typecheck, format | Clean                                           |

These were run locally in the development container. CI runs the same suites on
every push (`.github/workflows/ci.yml`: quality, database + API, browser jobs).

## 3. What the end-to-end suites cover

**API (`domain.e2e.ts`, `auth.e2e.ts`, `foundation.e2e.ts`)**

- Full path: public intake → queue → approve → agenda → transfer to a council
  member (same time) → live tracking → request closed.
- Transfer for a new time, scheduled once by the receiving member; a second
  scheduling and other members are refused.
- The Grand Syndic's private entry is masked for the Secretariat and blocks
  booking over it; cancelling it frees the time.
- Two concurrent approvals for the same slot: exactly one succeeds, the other
  gets `SLOT_CONFLICT` and its request stays `PENDING_REVIEW`.
- Past start times, appointments crossing midnight and unknown rooms are refused.
- Emergency postponement: affected requests return to the queue, apologies are
  queued, reschedule links work once (`410` afterwards), the day is suspended
  (`DAY_SUSPENDED`).
- Delegation: only the target branch sees the matter; another branch gets
  `404`; close and return change the request accordingly.
- Lawyers see only their own tickets; staff routes refuse them.
- Idempotency replay and key reuse with another body (`422`); missing key (`400`).
- Role revocation takes effect on the next request.
- Sign-in: generic errors, lockout, TOTP replay, enrolment confinement, refresh
  rotation and replay revocation, CSRF and Origin checks, forged tokens.
- The audit chain verifies at the end; only auditors can read it.

**Browser (`e2e/tests`)**

- A visitor submits the public form and receives a reference; the request is
  `PENDING_REVIEW` in the database (desktop and phone).
- A Secretariat officer signs in with password + TOTP, finds the request by
  search, approves it; the Grand Syndic signs in and sees it on the Grand Syndic's calendar.
- When the API cannot be reached, the queue shows an error with a retry button;
  retrying recovers. No stale data is shown as current.
- A member opening the Secretariat screen is refused; no session → sign-in page.
- A lawyer files a grievance and sees it in "my requests".
- A matter delegated to a branch is closed from the branch inbox.
- A reschedule link works once, removes the token from the address bar, and
  shows no free times (desktop and phone).

## 4. Manual checks performed

| Check                                                                              | Result                                                                                                     |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `admin:create` creates the first administrator, then refuses a second              | Created; second run: "An active system administrator already exists."                                      |
| First administrator sign-in in a browser → forced TOTP enrolment → account page    | Worked; no console errors                                                                                  |
| Session cookies after sign-in                                                      | `sba_access` and `sba_refresh` HttpOnly, SameSite=Strict; refresh path `/api/v1/auth`; `sba_csrf` readable |
| Static preview build (`SBA_PREVIEW=1`): all staff screens, approve flow on a phone | Worked from local storage, preview banner shown, no console errors                                         |
| Production build without a session: `/secretariat` etc.                            | No data rendered; browser redirected to sign-in                                                            |

## 5. Not covered yet

- Load and soak testing; rate limits across several API instances.
- Notification delivery (not implemented), document storage (not implemented).
- Accessibility audit with assistive technology (semantic roles and labels are
  used; no formal WCAG audit has been done).
- Restore drill from a real backup (procedure in `DEPLOYMENT.md`, not yet rehearsed).
