# Local secrets directory

Files in this directory are **git-ignored** (except this README). They are
mounted read-only into containers or read by the API at start-up.

Encryption keys are never stored in the database or the repository.

| File                  | Used from | Purpose                                                                                                   |
| --------------------- | --------- | --------------------------------------------------------------------------------------------------------- |
| `master-keys.json`    | Phase 3   | Key-encryption keys (KEKs) for envelope encryption, keyed by key id so old keys stay usable for rotation. |
| `pii-hmac-pepper`     | Phase 1   | Secret pepper for HMAC lookups of national ID numbers.                                                    |
| `jwt-signing-key.pem` | Phase 2   | Private key for signing short-lived access tokens.                                                        |

Generate development values with:

```sh
# 32 random bytes, base64 — one per KEK id
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

In production these files come from the on-premise secret store (e.g. a
root-owned tmpfs mount or Docker/Swarm secrets), never from environment files
checked into configuration management.
