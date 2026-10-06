import type { Prisma } from '../generated/prisma/client.js';
import { seedDemoData, type DemoSecrets } from './demo.js';
import { externalEntities, organizationalUnits } from './reference-data.js';
import { desiredTemplates, planTemplate } from './templates.js';

export interface SeedSummary {
  organizationalUnits: number;
  externalEntities: number;
  templatesCreated: number;
  templatesSuperseded: number;
  demoUsersCreated: number;
}

/**
 * Idempotent: safe to run on every deployment. Reference rows are inserted
 * when missing and never overwritten (they may have been edited by staff since);
 * templates follow the versioning rule in templates.ts. The caller runs it in
 * one transaction, so a failure leaves the database untouched.
 */
export async function seed(
  db: Prisma.TransactionClient,
  demo: DemoSecrets | null,
): Promise<SeedSummary> {
  const summary: SeedSummary = {
    organizationalUnits: 0,
    externalEntities: 0,
    templatesCreated: 0,
    templatesSuperseded: 0,
    demoUsersCreated: 0,
  };

  for (const unit of organizationalUnits()) {
    const existing = await db.organizationalUnit.findUnique({ where: { code: unit.code } });
    if (!existing) {
      await db.organizationalUnit.create({ data: unit });
      summary.organizationalUnits += 1;
    }
  }

  for (const entity of externalEntities()) {
    const existing = await db.externalEntity.findUnique({ where: { code: entity.code } });
    if (!existing) {
      await db.externalEntity.create({ data: { ...entity, defaultPriority: 'CRITICAL' } });
      summary.externalEntities += 1;
    }
  }

  for (const desired of desiredTemplates()) {
    const scope = { code: desired.code, channel: desired.channel, locale: 'ar' };
    const active = await db.notificationTemplate.findFirst({ where: { ...scope, isActive: true } });
    const highest = await db.notificationTemplate.aggregate({
      where: scope,
      _max: { version: true },
    });
    const plan = planTemplate(desired, active ?? undefined, highest._max.version ?? 0);

    if (plan.kind === 'unchanged') continue;
    if (plan.kind === 'supersede') {
      await db.notificationTemplate.update({
        where: { id: plan.retireId },
        data: { isActive: false },
      });
      summary.templatesSuperseded += 1;
    } else {
      summary.templatesCreated += 1;
    }
    await db.notificationTemplate.create({
      data: { ...scope, version: plan.version, subject: desired.subject, body: desired.body },
    });
  }

  if (demo) {
    summary.demoUsersCreated = await seedDemoData(db, demo);
  }

  await db.auditLog.create({
    data: {
      action: 'system.seed',
      entityType: 'system',
      entityId: 'seed',
      metadata: { ...summary, demo: demo !== null },
    },
  });

  return summary;
}
