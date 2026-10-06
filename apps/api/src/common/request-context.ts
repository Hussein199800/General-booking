import { randomUUID } from 'node:crypto';

import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { UserRole } from '@sba/shared';
import type { NextFunction, Request, Response } from 'express';

/** The authenticated principal behind a request (set by the auth guard). */
export interface Actor {
  readonly userId: string;
  readonly sessionId: string;
  readonly roles: readonly UserRole[];
  /** Role → organisational unit ids it is scoped to (branch officers, committee members). */
  readonly scopes: ReadonlyMap<UserRole, readonly string[]>;
  readonly mfaVerified: boolean;
}

export interface RequestContext {
  readonly requestId: string;
  readonly ip: string | null;
  readonly userAgent: string | null;
  actor?: Actor;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express augmentation API
  namespace Express {
    interface Request {
      ctx?: RequestContext;
    }
  }
}

/** Attaches request id, client IP (behind the trusted proxy) and user agent. */
export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = randomUUID();
  req.ctx = {
    requestId,
    ip: req.ip ?? null,
    userAgent: req.get('user-agent')?.slice(0, 512) ?? null,
  };
  res.setHeader('X-Request-Id', requestId);
  next();
}

export const Ctx = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestContext => {
    const ctx = context.switchToHttp().getRequest<Request>().ctx;
    if (!ctx) throw new Error('Request context middleware is not installed');
    return ctx;
  },
);
