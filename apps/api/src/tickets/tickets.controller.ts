import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  approveSchema,
  declineSchema,
  delegateSchema,
  grievanceSchema,
  lawyerAudienceRequestSchema,
  principalRequestSchema,
  prioritySchema,
  publicAudienceRequestSchema,
  queueQuerySchema,
  requestDocumentsSchema,
  type BookingInput,
  type GrievanceInput,
  type PublicAudienceRequestInput,
  type QueueQuery,
} from '@sba/shared';
import type { z } from 'zod';

import { Public, Roles } from '../auth/decorators.js';
import { Ctx, type RequestContext } from '../common/request-context.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { PUBLIC_SUBMIT_THROTTLE } from '../config/rate-limits.js';
import { Idempotent } from '../idempotency/idempotency.js';
import { TicketsService } from './tickets.service.js';

const SECRETARIAT = ['SECRETARIAT_HEAD', 'SECRETARIAT_OFFICER'] as const;

/** Tier 1 — anonymous intake. Never reveals availability; returns a reference only. */
@Controller('public')
export class PublicTicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Public()
  @Throttle(PUBLIC_SUBMIT_THROTTLE)
  @Idempotent('public.audience-request')
  @Post('audience-requests')
  create(
    @Body(new ZodPipe(publicAudienceRequestSchema)) body: PublicAudienceRequestInput,
    @Ctx() ctx: RequestContext,
  ) {
    return this.tickets.createPublicRequest(body, ctx);
  }
}

/** Tier 2 — a lawyer's own requests and grievances only. */
@Roles('LAWYER')
@Controller('lawyer')
export class LawyerTicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Idempotent('lawyer.grievance')
  @Post('grievances')
  grievance(@Body(new ZodPipe(grievanceSchema)) body: GrievanceInput, @Ctx() ctx: RequestContext) {
    return this.tickets.createGrievance(body, ctx);
  }

  @Idempotent('lawyer.audience-request')
  @Post('audience-requests')
  audience(
    @Body(new ZodPipe(lawyerAudienceRequestSchema))
    body: z.infer<typeof lawyerAudienceRequestSchema>,
    @Ctx() ctx: RequestContext,
  ) {
    return this.tickets.createLawyerRequest(body, ctx);
  }

  @Get('me/tickets')
  mine(@Ctx() ctx: RequestContext) {
    return this.tickets.listMine(ctx);
  }
}

/** Tier 3 — the Secretariat's queue and decisions. */
@Roles(...SECRETARIAT)
@Controller('secretariat')
export class SecretariatController {
  constructor(private readonly tickets: TicketsService) {}

  @Get('queue')
  queue(@Query(new ZodPipe(queueQuerySchema)) query: QueueQuery) {
    return this.tickets.queue(query);
  }

  @Get('requests/:id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.tickets.detail(id);
  }

  @Idempotent('secretariat.approve')
  @Post('requests/:id/approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(approveSchema)) body: BookingInput,
    @Ctx() ctx: RequestContext,
  ) {
    return this.tickets.approve(id, body, ctx);
  }

  @Idempotent('secretariat.delegate')
  @Post('requests/:id/delegate')
  delegate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(delegateSchema)) body: z.infer<typeof delegateSchema>,
    @Ctx() ctx: RequestContext,
  ) {
    return this.tickets.delegate(id, body, ctx);
  }

  @Idempotent('secretariat.request-documents')
  @Post('requests/:id/request-documents')
  requestDocuments(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(requestDocumentsSchema)) body: z.infer<typeof requestDocumentsSchema>,
    @Ctx() ctx: RequestContext,
  ) {
    return this.tickets.requestDocuments(id, body, ctx);
  }

  @Idempotent('secretariat.documents-received')
  @Post('requests/:id/documents-received')
  @HttpCode(200)
  documentsReceived(@Param('id', ParseUUIDPipe) id: string, @Ctx() ctx: RequestContext) {
    return this.tickets.documentsReceived(id, ctx);
  }

  @Idempotent('secretariat.decline')
  @Post('requests/:id/decline')
  @HttpCode(200)
  decline(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(declineSchema)) body: z.infer<typeof declineSchema>,
    @Ctx() ctx: RequestContext,
  ) {
    return this.tickets.decline(id, body.internalNote, ctx);
  }

  @Idempotent('secretariat.priority')
  @Post('requests/:id/priority')
  @HttpCode(200)
  priority(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(prioritySchema)) body: z.infer<typeof prioritySchema>,
    @Ctx() ctx: RequestContext,
  ) {
    return this.tickets.setPriority(id, body.priority, ctx);
  }
}

/** The Grand Syndic asks the Secretariat to arrange a meeting. */
@Roles('GRAND_SYNDIC')
@Controller('syndic')
export class SyndicRequestsController {
  constructor(private readonly tickets: TicketsService) {}

  @Idempotent('syndic.request')
  @Post('requests')
  create(
    @Body(new ZodPipe(principalRequestSchema)) body: z.infer<typeof principalRequestSchema>,
    @Ctx() ctx: RequestContext,
  ) {
    return this.tickets.createPrincipalRequest(body, ctx);
  }
}
