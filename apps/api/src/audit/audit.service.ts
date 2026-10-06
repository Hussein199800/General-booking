import { Injectable } from '@nestjs/common';
import type { Prisma } from '@sba/db';

import type { RequestContext } from '../common/request-context.js';

export interface AuditEntry {
  /** dotted, lower-case, e.g. "ticket.approve" (CHECK-enforced in the DB). */
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly before?: Prisma.InputJsonValue | null;
  readonly after?: Prisma.InputJsonValue | null;
  readonly metadata?: Prisma.InputJsonValue;
}

/**
 * Writes an append-only, hash-chained audit entry. Always called with the
 * transaction client of the change it describes, so the change and its record
 * commit or roll back together (implementation decision I-7).
 */
@Injectable()
export class AuditService {
  async record(
    tx: Prisma.TransactionClient,
    ctx: RequestContext,
    entry: AuditEntry,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        actorUserId: ctx.actor?.userId ?? null,
        actorRoles: [...(ctx.actor?.roles ?? [])],
        actorIp: ctx.ip,
        actorUserAgent: ctx.userAgent,
        sessionId: ctx.actor?.sessionId ?? null,
        requestId: ctx.requestId,
        ...(entry.before == null ? {} : { beforeState: entry.before }),
        ...(entry.after == null ? {} : { afterState: entry.after }),
        metadata: entry.metadata ?? {},
      },
    });
  }
}
