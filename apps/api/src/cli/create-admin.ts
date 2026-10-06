/**
 * Bootstrap: creates the first SYSTEM_ADMIN on a fresh installation. Refuses to
 * run once any active administrator exists — after that, accounts are managed
 * through the API by administrators.
 *
 *   pnpm --filter @sba/api admin:create --email admin@example.org --name "Full Name" \
 *     --password-file /run/secrets/initial-admin-password
 *
 * Without --password-file the password is read from standard input (piped).
 * The administrator must enrol TOTP at first sign-in.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { createPrismaClient } from '@sba/db';
import { newPasswordSchema } from '@sba/shared';
import { hash } from 'argon2';
import { z } from 'zod';

import { AuditService } from '../audit/audit.service.js';

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    // `pnpm run x -- …` passes the separator through; ignore it.
    args: process.argv.slice(2).filter((arg) => arg !== '--'),
    options: {
      email: { type: 'string' },
      name: { type: 'string' },
      'password-file': { type: 'string' },
    },
  });
  const email = z.email().parse(values.email?.trim().toLowerCase());
  const fullName = z.string().trim().min(2).max(120).parse(values.name);
  const raw = values['password-file']
    ? readFileSync(values['password-file'], 'utf8')
    : await readStdin();
  const password = newPasswordSchema.parse(raw.replace(/\r?\n$/, ''));

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const prisma = createPrismaClient(url);
  try {
    const passwordHash = await hash(password, { type: 2 });
    const id = await prisma.$transaction(async (tx) => {
      const existing = await tx.userRoleGrant.count({
        where: { role: 'SYSTEM_ADMIN', revokedAt: null, user: { status: 'ACTIVE' } },
      });
      if (existing > 0) throw new Error('An active system administrator already exists.');
      const user = await tx.user.create({
        data: { email, fullName, passwordHash, status: 'ACTIVE' },
      });
      await tx.userRoleGrant.create({ data: { userId: user.id, role: 'SYSTEM_ADMIN' } });
      await new AuditService().record(
        tx,
        { requestId: randomUUID(), ip: null, userAgent: 'cli/create-admin' },
        {
          action: 'admin.bootstrap',
          entityType: 'user',
          entityId: user.id,
          after: { email, roles: ['SYSTEM_ADMIN'] },
        },
      );
      return user.id;
    });
    process.stdout.write(`Created system administrator ${id}. Enrol TOTP at first sign-in.\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
