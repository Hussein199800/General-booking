import {
  Body,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  canTransitionTicket,
  unitDecisionSchema,
  type TicketSummary,
  type UserRole,
} from '@sba/shared';
import type { z } from 'zod';

import { AuditService } from '../audit/audit.service.js';
import { Roles } from '../auth/decorators.js';
import { AppError } from '../common/app-error.js';
import { Ctx, type RequestContext } from '../common/request-context.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { Idempotent } from '../idempotency/idempotency.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  requireActor,
  ticketInclude,
  TicketsService,
  toSummary,
} from '../tickets/tickets.service.js';
import { TicketsModule } from '../tickets/tickets.module.js';

const UNIT_ROLES: UserRole[] = ['BRANCH_OFFICER', 'COMMITTEE_MEMBER'];

export interface InboxItem {
  readonly assignmentId: string;
  readonly status: string;
  readonly instructions: string | null;
  readonly assignedAt: string;
  readonly ticket: TicketSummary;
}

/**
 * Branch councils and committees see only what was delegated to their own unit
 * (scoped role grants), and either close the matter or return it (decision Q2).
 */
@Injectable()
export class UnitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tickets: TicketsService,
  ) {}

  private unitIds(ctx: RequestContext): string[] {
    const actor = requireActor(ctx);
    return UNIT_ROLES.flatMap((role) => [...(actor.scopes.get(role) ?? [])]);
  }

  async inbox(ctx: RequestContext): Promise<InboxItem[]> {
    const rows = await this.prisma.client.routingAssignment.findMany({
      where: {
        targetOrgUnitId: { in: this.unitIds(ctx) },
        status: { in: ['ACTIVE', 'ACKNOWLEDGED'] },
      },
      include: { ticket: { include: ticketInclude } },
      orderBy: { assignedAt: 'asc' },
    });
    return rows.map((row) => ({
      assignmentId: row.id,
      status: row.status,
      instructions: row.instructions,
      assignedAt: row.assignedAt.toISOString(),
      ticket: toSummary(row.ticket),
    }));
  }

  private async load(id: string, ctx: RequestContext) {
    const row = await this.prisma.client.routingAssignment.findUnique({ where: { id } });
    // Out-of-scope assignments are indistinguishable from missing ones.
    if (!row?.targetOrgUnitId || !this.unitIds(ctx).includes(row.targetOrgUnitId))
      throw new AppError('NOT_FOUND');
    return row;
  }

  async detail(id: string, ctx: RequestContext) {
    const row = await this.load(id, ctx);
    return this.tickets.detail(row.ticketId);
  }

  async acknowledge(id: string, ctx: RequestContext) {
    const row = await this.load(id, ctx);
    if (row.status !== 'ACTIVE') throw new AppError('ILLEGAL_TRANSITION');
    await this.prisma.client.$transaction(async (tx) => {
      await tx.routingAssignment.update({
        where: { id },
        data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date() },
      });
      await this.audit.record(tx, ctx, {
        action: 'routing.acknowledge',
        entityType: 'routing_assignment',
        entityId: id,
      });
    });
    return { ok: true };
  }

  async resolve(
    id: string,
    outcome: 'CLOSE' | 'RETURN',
    note: string | undefined,
    ctx: RequestContext,
  ) {
    const row = await this.load(id, ctx);
    if (row.status !== 'ACTIVE' && row.status !== 'ACKNOWLEDGED')
      throw new AppError('ILLEGAL_TRANSITION');
    const ticketStatus = outcome === 'CLOSE' ? 'CLOSED' : 'PENDING_REVIEW';
    await this.prisma.client.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUniqueOrThrow({ where: { id: row.ticketId } });
      if (!canTransitionTicket(ticket.kind, ticket.status, ticketStatus))
        throw new AppError('ILLEGAL_TRANSITION');
      await tx.routingAssignment.update({
        where: { id },
        data: {
          status: outcome === 'CLOSE' ? 'COMPLETED' : 'RETURNED',
          resolvedAt: new Date(),
          resolutionNote: note ?? null,
        },
      });
      await tx.ticket.update({
        where: { id: ticket.id },
        data: { status: ticketStatus, version: { increment: 1 } },
      });
      await this.audit.record(tx, ctx, {
        action: outcome === 'CLOSE' ? 'routing.close' : 'routing.return',
        entityType: 'ticket',
        entityId: ticket.id,
        before: { status: ticket.status },
        after: { status: ticketStatus },
        metadata: { assignmentId: id },
      });
    });
    return { ok: true };
  }
}

@Roles(...UNIT_ROLES)
@Controller('units')
export class UnitsController {
  constructor(private readonly units: UnitsService) {}

  @Get('inbox')
  inbox(@Ctx() ctx: RequestContext) {
    return this.units.inbox(ctx);
  }

  @Get('assignments/:id')
  detail(@Param('id', ParseUUIDPipe) id: string, @Ctx() ctx: RequestContext) {
    return this.units.detail(id, ctx);
  }

  @Idempotent('units.acknowledge')
  @Post('assignments/:id/acknowledge')
  @HttpCode(200)
  acknowledge(@Param('id', ParseUUIDPipe) id: string, @Ctx() ctx: RequestContext) {
    return this.units.acknowledge(id, ctx);
  }

  @Idempotent('units.close')
  @Post('assignments/:id/close')
  @HttpCode(200)
  close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(unitDecisionSchema)) body: z.infer<typeof unitDecisionSchema>,
    @Ctx() ctx: RequestContext,
  ) {
    return this.units.resolve(id, 'CLOSE', body.note, ctx);
  }

  @Idempotent('units.return')
  @Post('assignments/:id/return')
  @HttpCode(200)
  giveBack(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(unitDecisionSchema)) body: z.infer<typeof unitDecisionSchema>,
    @Ctx() ctx: RequestContext,
  ) {
    return this.units.resolve(id, 'RETURN', body.note, ctx);
  }
}

@Module({ imports: [TicketsModule], controllers: [UnitsController], providers: [UnitsService] })
export class UnitsModule {}
