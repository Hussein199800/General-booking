import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  agendaQuerySchema,
  emergencySchema,
  ownEntrySchema,
  rescheduleResponseSchema,
  scheduleTransferSchema,
  trackSchema,
  transferSchema,
  type BookingInput,
} from '@sba/shared';
import type { Request } from 'express';
import type { z } from 'zod';

import { Public, Roles } from '../auth/decorators.js';
import { AppError } from '../common/app-error.js';
import { Ctx, type RequestContext } from '../common/request-context.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { PUBLIC_SUBMIT_THROTTLE } from '../config/rate-limits.js';
import { Idempotent } from '../idempotency/idempotency.js';
import { AgendaService } from './agenda.service.js';

@Controller()
export class AgendaController {
  constructor(private readonly agenda: AgendaService) {}

  /** Day / week / month views are ranges of up to 62 days. */
  @Roles('GRAND_SYNDIC', 'SECRETARIAT_HEAD', 'SECRETARIAT_OFFICER', 'COUNCIL_MEMBER')
  @Get('agenda')
  list(
    @Query(new ZodPipe(agendaQuerySchema)) query: z.infer<typeof agendaQuerySchema>,
    @Ctx() ctx: RequestContext,
  ) {
    return this.agenda.list(ctx, query.from, query.to, query.principalId);
  }

  @Roles('GRAND_SYNDIC')
  @Idempotent('syndic.entry')
  @Post('syndic/entries')
  createEntry(
    @Body(new ZodPipe(ownEntrySchema)) body: z.infer<typeof ownEntrySchema>,
    @Ctx() ctx: RequestContext,
  ) {
    return this.agenda.createOwnEntry(body, ctx);
  }

  @Roles('GRAND_SYNDIC')
  @Idempotent('syndic.entry-cancel')
  @Post('syndic/entries/:id/cancel')
  @HttpCode(200)
  cancelEntry(@Param('id', ParseUUIDPipe) id: string, @Ctx() ctx: RequestContext) {
    return this.agenda.cancelOwnEntry(id, ctx);
  }

  @Roles('GRAND_SYNDIC')
  @Idempotent('syndic.transfer')
  @Post('syndic/appointments/:id/transfer')
  @HttpCode(200)
  transfer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(transferSchema)) body: z.infer<typeof transferSchema>,
    @Ctx() ctx: RequestContext,
  ) {
    return this.agenda.transfer(id, body, ctx);
  }

  /** Decision Q9: the Grand Syndic, or the head of the Secretariat on his behalf. */
  @Roles('GRAND_SYNDIC', 'SECRETARIAT_HEAD')
  @Idempotent('syndic.emergency')
  @Post('syndic/emergency-reschedule')
  @HttpCode(200)
  emergency(
    @Body(new ZodPipe(emergencySchema)) body: z.infer<typeof emergencySchema>,
    @Ctx() ctx: RequestContext,
    @Req() req: Request,
  ) {
    const key = req.get('Idempotency-Key');
    if (!key) throw new AppError('IDEMPOTENCY_KEY_REQUIRED');
    return this.agenda.emergencyPostpone(body.from, key, ctx);
  }

  @Roles('SECRETARIAT_HEAD', 'SECRETARIAT_OFFICER', 'COUNCIL_MEMBER')
  @Get('transfers/pending')
  pending(@Ctx() ctx: RequestContext) {
    return this.agenda.pendingTransfers(ctx);
  }

  @Roles('SECRETARIAT_HEAD', 'SECRETARIAT_OFFICER', 'COUNCIL_MEMBER')
  @Idempotent('transfer.schedule')
  @Post('transfers/:id/schedule')
  schedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(scheduleTransferSchema)) body: BookingInput,
    @Ctx() ctx: RequestContext,
  ) {
    return this.agenda.scheduleTransfer(id, body, ctx);
  }

  @Roles('SECRETARIAT_HEAD', 'SECRETARIAT_OFFICER')
  @Idempotent('agenda.track')
  @Post('agenda/appointments/:id/track')
  @HttpCode(200)
  track(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(trackSchema)) body: z.infer<typeof trackSchema>,
    @Ctx() ctx: RequestContext,
  ) {
    return this.agenda.track(id, body.step, ctx);
  }

  @Roles('GRAND_SYNDIC', 'SECRETARIAT_HEAD', 'SECRETARIAT_OFFICER')
  @Get('reference/members')
  members() {
    return this.agenda.members();
  }

  @Public()
  @Throttle(PUBLIC_SUBMIT_THROTTLE)
  @Post('public/reschedule/:token')
  @HttpCode(200)
  reschedule(
    @Param('token') token: string,
    @Body(new ZodPipe(rescheduleResponseSchema)) body: z.infer<typeof rescheduleResponseSchema>,
    @Ctx() ctx: RequestContext,
  ) {
    if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) throw new AppError('LINK_INVALID');
    return this.agenda.respondToReschedule(token, body.preference, ctx);
  }
}
