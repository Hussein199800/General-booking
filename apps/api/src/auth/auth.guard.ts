import { timingSafeEqual } from 'node:crypto';

import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MFA_REQUIRED_ROLES, type UserRole } from '@sba/shared';
import type { Request } from 'express';

import { AppError } from '../common/app-error.js';
import { APP_ENV, SECRETS } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import type { Secrets } from '../config/secrets.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ACCESS_COOKIE, CSRF_COOKIE } from './cookies.js';
import { ALLOW_WITHOUT_MFA, IS_PUBLIC, ROLES } from './decorators.js';
import { verifyAccessToken } from './tokens.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function sameToken(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Global guard (hard rule 5: RBAC on the server for every endpoint).
 * 1. Unsafe methods: Origin must be allowlisted (when present).
 * 2. Unless @Public: valid access token, live session, ACTIVE user.
 * 3. Roles are re-read from user_roles on every request (I-5).
 * 4. Staff roles must have completed MFA in this session (I-6).
 * 5. Unsafe methods: double-submit CSRF token (I-3).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    @Inject(APP_ENV) private readonly env: Env,
    @Inject(SECRETS) private readonly secrets: Secrets,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const targets = [context.getHandler(), context.getClass()];
    const unsafe = !SAFE_METHODS.has(request.method);

    const origin = request.get('origin');
    if (unsafe && origin && !this.env.CORS_ALLOWED_ORIGINS.includes(origin))
      throw new AppError('CSRF');

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const cookies = request.cookies as Record<string, string | undefined>;
    const token = cookies[ACCESS_COOKIE];
    const claims = token ? await verifyAccessToken(this.secrets.jwtKey, token) : null;
    if (!claims) throw new AppError('UNAUTHENTICATED');

    const session = await this.prisma.client.session.findUnique({
      where: { id: claims.sessionId },
      include: {
        user: {
          select: {
            id: true,
            status: true,
            roles: { where: { revokedAt: null }, select: { role: true, orgUnitId: true } },
          },
        },
      },
    });
    const now = new Date();
    if (
      !session ||
      session.userId !== claims.userId ||
      session.revokedAt ||
      session.absoluteExpiresAt <= now ||
      session.user.status !== 'ACTIVE'
    ) {
      throw new AppError('UNAUTHENTICATED');
    }

    const roles = [...new Set(session.user.roles.map((grant) => grant.role))];
    const scopes = new Map<UserRole, string[]>();
    for (const grant of session.user.roles) {
      if (grant.orgUnitId)
        scopes.set(grant.role, [...(scopes.get(grant.role) ?? []), grant.orgUnitId]);
    }
    const mfaVerified = session.mfaVerifiedAt !== null;
    if (!request.ctx) throw new Error('Request context middleware is not installed');
    request.ctx = {
      ...request.ctx,
      actor: { userId: session.userId, sessionId: session.id, roles, scopes, mfaVerified },
    };

    const allowWithoutMfa = this.reflector.getAllAndOverride<boolean>(ALLOW_WITHOUT_MFA, targets);
    if (!allowWithoutMfa && !mfaVerified && roles.some((role) => MFA_REQUIRED_ROLES.has(role))) {
      throw new AppError('MFA_REQUIRED');
    }

    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES, targets);
    if (required && !required.some((role) => roles.includes(role))) throw new AppError('FORBIDDEN');

    if (unsafe) {
      const header = request.get('x-csrf-token');
      const cookie = cookies[CSRF_COOKIE];
      if (!header || !cookie || !sameToken(header, cookie)) throw new AppError('CSRF');
    }
    return true;
  }
}
