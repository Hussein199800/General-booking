import { createHash } from 'node:crypto';

import {
  Injectable,
  SetMetadata,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Prisma } from '@sba/db';
import type { Request, Response } from 'express';
import { catchError, from, mergeMap, of, throwError, type Observable } from 'rxjs';

import { AppError, sqlState } from '../common/app-error.js';
import { PrismaService } from '../prisma/prisma.service.js';

const IDEMPOTENT = 'sba:idempotent';
const KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const RETENTION_MS = 24 * 3_600_000;

/** Marks a mutating route as requiring an `Idempotency-Key` header. */
export const Idempotent = (scope: string) => SetMetadata(IDEMPOTENT, scope);

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, stable(v)]),
    );
  }
  return value;
}

/**
 * A retried request with the same key and body gets the stored response instead
 * of executing twice; the same key with a different body is rejected. The key is
 * reserved before the handler runs (unique index), so concurrent duplicates
 * cannot both execute; it is released if the handler fails, allowing a retry.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const name = this.reflector.get<string | undefined>(IDEMPOTENT, context.getHandler());
    if (!name) return next.handle();

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const key = request.get('Idempotency-Key');
    if (!key || !KEY_PATTERN.test(key)) throw new AppError('IDEMPOTENCY_KEY_REQUIRED');

    const db = this.prisma.client;
    const userId = request.ctx?.actor?.userId ?? null;
    const scope = `${name} ${JSON.stringify(stable(request.params))}`.slice(0, 300);
    const requestHash = createHash('sha256')
      .update(JSON.stringify(stable(request.body ?? {})))
      .digest();

    const existing = await db.idempotencyKey.findFirst({ where: { scope, userId, key } });
    if (existing) {
      if (!Buffer.from(existing.requestHash).equals(requestHash))
        throw new AppError('IDEMPOTENCY_KEY_REUSED');
      if (existing.responseStatus === null) throw new AppError('IDEMPOTENCY_IN_PROGRESS');
      response.status(existing.responseStatus);
      response.setHeader('Idempotent-Replay', 'true');
      return of(existing.responseBody);
    }

    let reservationId: string;
    try {
      const reservation = await db.idempotencyKey.create({
        data: {
          scope,
          userId,
          key,
          requestHash: Uint8Array.from(requestHash),
          expiresAt: new Date(Date.now() + RETENTION_MS),
        },
        select: { id: true },
      });
      reservationId = reservation.id;
    } catch (error) {
      if (sqlState(error) === '23505') throw new AppError('IDEMPOTENCY_IN_PROGRESS');
      throw error;
    }

    return next.handle().pipe(
      mergeMap((body: unknown) =>
        from(
          db.idempotencyKey
            .update({
              where: { id: reservationId },
              data: {
                responseStatus: response.statusCode,
                responseBody: (body ?? null) as Prisma.InputJsonValue,
              },
            })
            .then(() => body),
        ),
      ),
      // Release the reservation so the client may retry, then rethrow the original error.
      catchError((error: unknown) =>
        from(
          db.idempotencyKey.delete({ where: { id: reservationId } }).catch(() => undefined),
        ).pipe(mergeMap(() => throwError(() => error))),
      ),
    );
  }
}
