import { Controller, Get, Module, Query } from '@nestjs/common';
import { auditQuerySchema } from '@sba/shared';
import type { z } from 'zod';

import { Roles } from '../auth/decorators.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Read-only oversight: the audit trail (auditors) and operational figures. */
@Controller()
export class OversightController {
  constructor(private readonly prisma: PrismaService) {}

  @Roles('AUDITOR')
  @Get('audit')
  async audit(@Query(new ZodPipe(auditQuerySchema)) query: z.infer<typeof auditQuerySchema>) {
    const where = {
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.client.auditLog.count({ where }),
      this.prisma.client.auditLog.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      total,
      page: query.page,
      pageSize: query.pageSize,
      items: rows.map((r) => ({
        id: r.id.toString(),
        occurredAt: r.occurredAt.toISOString(),
        actorUserId: r.actorUserId,
        actorRoles: r.actorRoles,
        actorIp: r.actorIp,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        before: r.beforeState,
        after: r.afterState,
        metadata: r.metadata,
      })),
    };
  }

  /** Recomputes the hash chain; reports the first broken row, if any. */
  @Roles('AUDITOR')
  @Get('audit/verify')
  async verify() {
    const [row] = await this.prisma.client.$queryRaw<
      { broken: bigint | null }[]
    >`SELECT audit_verify_chain() AS broken`;
    return { intact: row?.broken === null, firstBrokenId: row?.broken?.toString() ?? null };
  }

  /** Workload and delay figures for the Secretariat head (P3 reporting, first cut). */
  @Roles('SECRETARIAT_HEAD', 'AUDITOR')
  @Get('reports/summary')
  async summary() {
    const [byStatus, byPriority, overdue, timing] = await Promise.all([
      this.prisma.client.ticket.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.client.ticket.groupBy({
        by: ['priority'],
        where: { status: { in: ['PENDING_REVIEW', 'AWAITING_DOCUMENTS'] } },
        _count: { _all: true },
      }),
      this.prisma.client.ticket.count({
        where: {
          status: { in: ['PENDING_REVIEW', 'AWAITING_DOCUMENTS'] },
          submittedAt: { lt: new Date(Date.now() - 7 * 86_400_000) },
        },
      }),
      this.prisma.client.$queryRaw<{ hours: number | null }[]>`
        SELECT avg(extract(epoch FROM (status_changed_at - submitted_at)) / 3600)::float AS hours
        FROM tickets
        WHERE status <> 'PENDING_REVIEW' AND submitted_at > now() - interval '30 days'`,
    ]);
    return {
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
      openByPriority: Object.fromEntries(byPriority.map((r) => [r.priority, r._count._all])),
      openOlderThan7Days: overdue,
      averageHoursToFirstDecision30d: timing[0]?.hours ?? null,
    };
  }
}

@Module({ controllers: [OversightController] })
export class OversightModule {}
