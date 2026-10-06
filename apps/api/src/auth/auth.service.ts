import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@sba/db';
import {
  MFA_REQUIRED_ROLES,
  normalizeNationalId,
  type LawyerLoginInput,
  type LoginOutcome,
  type MeResponse,
  type StaffLoginInput,
  type UserRole,
} from '@sba/shared';
import { hash, verify } from 'argon2';

import { AuditService } from '../audit/audit.service.js';
import { AppError } from '../common/app-error.js';
import type { Actor, RequestContext } from '../common/request-context.js';
import { APP_ENV, SECRETS } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import type { Secrets } from '../config/secrets.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { randomToken, signAccessToken, tokenHash } from './tokens.js';
import { acceptedStep, newTotpSecret, totpUri } from './totp.js';

export interface SessionTokens {
  readonly access: string;
  readonly refresh: string;
  readonly csrf: string;
}

export interface LoginResult {
  readonly outcome: LoginOutcome;
  /** Absent when a second factor is still needed (no session is created). */
  readonly tokens?: SessionTokens;
}

type Channel = 'STAFF' | 'LAWYER';

const userWithRoles = {
  roles: { where: { revokedAt: null }, select: { role: true } },
} as const;

type UserWithRoles = Prisma.UserGetPayload<{ include: typeof userWithRoles }>;

const ARGON2 = { type: 2 as const }; // argon2id with library defaults (64 MiB, t=3, p=4)

@Injectable()
export class AuthService {
  /** Verified against when the account does not exist, so timing does not reveal it. */
  private readonly dummyHash = hash(randomToken(), ARGON2);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(APP_ENV) private readonly env: Env,
    @Inject(SECRETS) private readonly secrets: Secrets,
  ) {}

  async staffLogin(input: StaffLoginInput, ctx: RequestContext): Promise<LoginResult> {
    const user = await this.prisma.client.user.findUnique({
      where: { email: input.email },
      include: userWithRoles,
    });
    return this.authenticate(user, input.password, input.otp, ctx, 'STAFF');
  }

  async lawyerLogin(input: LawyerLoginInput, ctx: RequestContext): Promise<LoginResult> {
    const profile = await this.prisma.client.lawyerProfile.findUnique({
      where: { registrationNumber: input.registrationNumber },
      include: { user: { include: userWithRoles } },
    });
    const nationalId = normalizeNationalId(input.nationalId);
    // A wrong national ID is treated exactly like a wrong password.
    const identityMatches =
      profile !== null &&
      nationalId !== null &&
      this.secrets.pepper.matches(nationalId, Buffer.from(profile.nationalIdHmac));
    return this.authenticate(
      profile?.user ?? null,
      input.password,
      input.otp,
      ctx,
      'LAWYER',
      identityMatches,
    );
  }

  private async authenticate(
    user: UserWithRoles | null,
    password: string,
    otp: string | undefined,
    ctx: RequestContext,
    channel: Channel,
    identityMatches = true,
  ): Promise<LoginResult> {
    const now = new Date();
    if (!user) {
      await verify(await this.dummyHash, password).catch(() => false);
      await this.recordAnonymousFailure(ctx, channel);
      throw new AppError('INVALID_CREDENTIALS');
    }

    if (user.lockedUntil && user.lockedUntil > now) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60_000);
      throw new AppError('ACCOUNT_LOCKED', { minutes });
    }

    const passwordOk = await verify(user.passwordHash, password).catch(() => false);
    const roles = user.roles.map((grant) => grant.role);
    const channelOk =
      channel === 'LAWYER' ? roles.includes('LAWYER') : roles.some((role) => role !== 'LAWYER');
    if (!passwordOk || !identityMatches || !channelOk) {
      await this.recordFailure(user, ctx, channel);
      throw new AppError('INVALID_CREDENTIALS');
    }
    if (user.status !== 'ACTIVE') throw new AppError('ACCOUNT_DISABLED');

    let mfaVerified = false;
    let lastStep: number | null = null;
    if (user.mfaEnabledAt) {
      if (!otp) return { outcome: { status: 'MFA_REQUIRED' } };
      lastStep = this.acceptOtp(user, otp);
      if (lastStep === null) {
        await this.recordFailure(user, ctx, channel);
        throw new AppError('MFA_INVALID');
      }
      mfaVerified = true;
    }
    const enrollmentRequired =
      !user.mfaEnabledAt && channel === 'STAFF' && roles.some((r) => MFA_REQUIRED_ROLES.has(r));

    const tokens = await this.prisma.client.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: 0,
          lockedUntil: null,
          lastLoginAt: now,
          ...(lastStep === null ? {} : { mfaLastStep: BigInt(lastStep) }),
        },
      });
      const created = await this.openSession(tx, user.id, ctx, mfaVerified ? now : null);
      await this.audit.record(
        tx,
        { ...ctx, actor: this.actorFor(user.id, created.sessionId, roles, mfaVerified) },
        {
          action: 'auth.login',
          entityType: 'user',
          entityId: user.id,
          metadata: { channel, mfa: mfaVerified, enrollmentRequired },
        },
      );
      return created.tokens;
    });

    return { outcome: { status: enrollmentRequired ? 'MFA_ENROLLMENT_REQUIRED' : 'OK' }, tokens };
  }

  /** Rotates the refresh token; presenting an already-rotated token revokes the whole session. */
  async refresh(refreshToken: string | undefined, ctx: RequestContext): Promise<SessionTokens> {
    if (!refreshToken) throw new AppError('UNAUTHENTICATED');
    const db = this.prisma.client;
    const now = new Date();
    const record = await db.refreshToken.findUnique({
      where: { tokenHash: tokenHash(refreshToken) },
      include: { session: { include: { user: true } } },
    });
    if (!record) throw new AppError('UNAUTHENTICATED');
    const { session } = record;

    if (record.rotatedAt) {
      await db.$transaction(async (tx) => {
        await tx.session.updateMany({
          where: { id: session.id, revokedAt: null },
          data: { revokedAt: now, revokedReason: 'REFRESH_TOKEN_REUSE' },
        });
        await this.audit.record(tx, ctx, {
          action: 'auth.refresh_reuse',
          entityType: 'session',
          entityId: session.id,
          metadata: { userId: session.userId },
        });
      });
      throw new AppError('UNAUTHENTICATED');
    }
    if (
      record.expiresAt <= now ||
      session.revokedAt ||
      session.absoluteExpiresAt <= now ||
      session.user.status !== 'ACTIVE'
    ) {
      throw new AppError('UNAUTHENTICATED');
    }

    return db.$transaction(async (tx) => {
      const nextId = randomUUID();
      // Atomic claim: a concurrent refresh with the same token loses here.
      const claimed = await tx.refreshToken.updateMany({
        where: { id: record.id, rotatedAt: null },
        data: { rotatedAt: now, replacedById: nextId },
      });
      if (claimed.count !== 1) throw new AppError('UNAUTHENTICATED');
      const refresh = randomToken();
      await tx.refreshToken.create({
        data: {
          id: nextId,
          sessionId: session.id,
          tokenHash: tokenHash(refresh),
          expiresAt: this.idleExpiry(now, session.absoluteExpiresAt),
        },
      });
      await tx.session.update({ where: { id: session.id }, data: { lastSeenAt: now } });
      const access = await signAccessToken(
        this.secrets.jwtKey,
        { userId: session.userId, sessionId: session.id },
        this.env.ACCESS_TOKEN_TTL_SECONDS,
      );
      return { access, refresh, csrf: randomToken() };
    });
  }

  async logout(ctx: RequestContext): Promise<void> {
    const actor = ctx.actor;
    if (!actor) return;
    await this.prisma.client.$transaction(async (tx) => {
      await tx.session.updateMany({
        where: { id: actor.sessionId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'LOGOUT' },
      });
      await this.audit.record(tx, ctx, {
        action: 'auth.logout',
        entityType: 'session',
        entityId: actor.sessionId,
      });
    });
  }

  async me(actor: Actor): Promise<MeResponse> {
    const user = await this.prisma.client.user.findUniqueOrThrow({ where: { id: actor.userId } });
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      roles: actor.roles,
      mfaEnabled: user.mfaEnabledAt !== null,
      mfaVerified: actor.mfaVerified,
    };
  }

  /** Issues a fresh TOTP secret (stored encrypted, bound to the user) for enrolment. */
  async startMfaEnrollment(ctx: RequestContext): Promise<{ otpauthUri: string; secret: string }> {
    const actor = this.requireActor(ctx);
    return this.prisma.client.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: actor.userId } });
      if (user.mfaEnabledAt) throw new AppError('CONFLICT');
      const secret = newTotpSecret();
      const sealed = this.secrets.keyRing.seal(
        Buffer.from(secret, 'utf8'),
        Buffer.from(user.id, 'utf8'),
      );
      await tx.user.update({
        where: { id: user.id },
        data: {
          mfaTotpSecretEnc: Uint8Array.from(sealed.box),
          mfaKeyId: sealed.keyId,
          mfaLastStep: null,
        },
      });
      await this.audit.record(tx, ctx, {
        action: 'auth.mfa_enrollment_started',
        entityType: 'user',
        entityId: user.id,
      });
      return { otpauthUri: totpUri(secret, user.email ?? user.fullName), secret };
    });
  }

  async confirmMfaEnrollment(otp: string, ctx: RequestContext): Promise<void> {
    const actor = this.requireActor(ctx);
    const now = new Date();
    await this.prisma.client.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: actor.userId } });
      if (user.mfaEnabledAt || !user.mfaTotpSecretEnc) throw new AppError('CONFLICT');
      const step = this.acceptOtp(user, otp);
      if (step === null) throw new AppError('MFA_INVALID');
      await tx.user.update({
        where: { id: user.id },
        data: { mfaEnabledAt: now, mfaLastStep: BigInt(step) },
      });
      await tx.session.update({ where: { id: actor.sessionId }, data: { mfaVerifiedAt: now } });
      await this.audit.record(tx, ctx, {
        action: 'auth.mfa_enabled',
        entityType: 'user',
        entityId: user.id,
      });
    });
  }

  async changePassword(
    currentPassword: string,
    newPassword: string,
    ctx: RequestContext,
  ): Promise<void> {
    const actor = this.requireActor(ctx);
    const user = await this.prisma.client.user.findUniqueOrThrow({ where: { id: actor.userId } });
    if (!(await verify(user.passwordHash, currentPassword).catch(() => false))) {
      throw new AppError('INVALID_CREDENTIALS');
    }
    const passwordHash = await hash(newPassword, ARGON2);
    await this.prisma.client.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash, passwordChangedAt: new Date() },
      });
      // Every other session of this user ends.
      await tx.session.updateMany({
        where: { userId: user.id, revokedAt: null, id: { not: actor.sessionId } },
        data: { revokedAt: new Date(), revokedReason: 'PASSWORD_CHANGED' },
      });
      await this.audit.record(tx, ctx, {
        action: 'auth.password_changed',
        entityType: 'user',
        entityId: user.id,
      });
    });
  }

  // ---------------------------------------------------------------------------

  private acceptOtp(
    user: {
      id: string;
      mfaTotpSecretEnc: Uint8Array | null;
      mfaKeyId: string | null;
      mfaLastStep: bigint | null;
    },
    otp: string,
  ): number | null {
    if (!user.mfaTotpSecretEnc || !user.mfaKeyId) return null;
    const secret = this.secrets.keyRing
      .open(user.mfaKeyId, Buffer.from(user.mfaTotpSecretEnc), Buffer.from(user.id, 'utf8'))
      .toString('utf8');
    const step = acceptedStep(secret, otp);
    if (step === null) return null;
    if (user.mfaLastStep !== null && BigInt(step) <= user.mfaLastStep) return null; // replay
    return step;
  }

  private async openSession(
    tx: Prisma.TransactionClient,
    userId: string,
    ctx: RequestContext,
    mfaVerifiedAt: Date | null,
  ): Promise<{ sessionId: string; tokens: SessionTokens }> {
    const now = new Date();
    const absoluteExpiresAt = new Date(
      now.getTime() + this.env.SESSION_ABSOLUTE_TTL_SECONDS * 1000,
    );
    const session = await tx.session.create({
      data: { userId, ip: ctx.ip, userAgent: ctx.userAgent, mfaVerifiedAt, absoluteExpiresAt },
    });
    const refresh = randomToken();
    await tx.refreshToken.create({
      data: {
        sessionId: session.id,
        tokenHash: tokenHash(refresh),
        expiresAt: this.idleExpiry(now, absoluteExpiresAt),
      },
    });
    const access = await signAccessToken(
      this.secrets.jwtKey,
      { userId, sessionId: session.id },
      this.env.ACCESS_TOKEN_TTL_SECONDS,
    );
    return { sessionId: session.id, tokens: { access, refresh, csrf: randomToken() } };
  }

  private idleExpiry(now: Date, absolute: Date): Date {
    const idle = new Date(now.getTime() + this.env.SESSION_IDLE_TTL_SECONDS * 1000);
    return idle < absolute ? idle : absolute;
  }

  private async recordFailure(
    user: UserWithRoles,
    ctx: RequestContext,
    channel: Channel,
  ): Promise<void> {
    const failures = user.failedLoginCount + 1;
    const lock = failures >= this.env.LOGIN_MAX_FAILURES;
    await this.prisma.client.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: lock
          ? {
              failedLoginCount: 0,
              lockedUntil: new Date(Date.now() + this.env.LOGIN_LOCK_MINUTES * 60_000),
            }
          : { failedLoginCount: failures },
      });
      await this.audit.record(tx, ctx, {
        action: lock ? 'auth.account_locked' : 'auth.login_failed',
        entityType: 'user',
        entityId: user.id,
        metadata: { channel, failures },
      });
    });
  }

  private async recordAnonymousFailure(ctx: RequestContext, channel: Channel): Promise<void> {
    await this.prisma.client.$transaction((tx) =>
      this.audit.record(tx, ctx, {
        action: 'auth.login_failed',
        entityType: 'user',
        entityId: 'unknown',
        metadata: { channel },
      }),
    );
  }

  private actorFor(
    userId: string,
    sessionId: string,
    roles: UserRole[],
    mfaVerified: boolean,
  ): Actor {
    return { userId, sessionId, roles, scopes: new Map(), mfaVerified };
  }

  private requireActor(ctx: RequestContext): Actor {
    if (!ctx.actor) throw new AppError('UNAUTHENTICATED');
    return ctx.actor;
  }
}
