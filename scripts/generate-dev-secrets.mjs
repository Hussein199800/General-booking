#!/usr/bin/env node
// Creates development key material in infra/secrets/ (git-ignored).
// Existing files are never overwritten: replacing a master key would make
// everything sealed under it unreadable.
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const secretsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'infra', 'secrets');
mkdirSync(secretsDir, { recursive: true });

const files = {
  'master-keys.json': () =>
    `${JSON.stringify({ 'kek-dev-01': randomBytes(32).toString('base64') }, null, 2)}\n`,
  'pii-hmac-pepper': () => `${randomBytes(32).toString('base64')}\n`,
  // HS256 key for short-lived access tokens.
  'jwt-signing-key': () => `${randomBytes(32).toString('base64')}\n`,
};

for (const [name, generate] of Object.entries(files)) {
  const path = join(secretsDir, name);
  if (existsSync(path)) {
    console.log(`kept      ${path}`);
    continue;
  }
  writeFileSync(path, generate(), { mode: 0o600 });
  console.log(`generated ${path}`);
}
