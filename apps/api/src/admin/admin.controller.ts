import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  createLawyerSchema,
  createStaffSchema,
  grantRoleSchema,
  normalizeNationalId,
  userStatusSchema,
  type UserRole,
} from '@sba/shared';
import { hash } from 'argon2';
import type { z } from 'zod';

import { AuditService } from '../audit/audit.service.js';
import { Roles } from '../auth/decorators.js';
import { AppError } from '../common/app-error.js';
import { Ctx, type RequestContext } from '../common/request-context.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { SECRETS } from '../config/config.module.js';
import type { Secrets } from '../config/secrets.js';
import { Idempotent } from '../idempotency/idempotency.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { requireActor } from '../tickets/tickets.service.js';

const SCOPED: UserRole[] = ['BRANCH_OFFICER', 'COMMITTEE_MEMBER'];

/**
 * Account administration (SYSTEM_ADMIN). Administrators manage accounts and
 * roles but have no route to case content (decision D2 / role table).
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(SECRETS) private readonly secrets: Secrets,
  ) {}

  async list() {
    const users = await this.prisma.client.user.findMany({
      include: {
        roles: { where: { revokedAt: null }, include: { orgUnit: { select: { code: true } } } },
      },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
    return users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      status: u.status,
      mfaEnabled: u.mfaEnabledAt !== null,
      lockedUntil: u.lockedUntil?.toISOString() ?? null,
      roles: u.roles.map((r) => ({
        grantId: r.id,
        role: r.role,
        orgUnitCode: r.orgUnit?.code ?? null,
      })),
    }));
  }

  private async unitId(role: UserRole, code: string | undefined): Promise<string | null> {
    if (!SCOPED.includes(role)) return null;
    if (!code) throw new AppError('VALIDATION', {}, ['orgUnitCode']);
    const unit = await this.prisma.client.organizationalUnit.findUnique({ where: { code } });
    if (!unit) throw new AppError('VALIDATION', {}, ['orgUnitCode']);
    return unit.id;
  }

  async createStaff(input: z.infer<typeof createStaffSchema>, ctx: RequestContext) {
    const actor = requireActor(ctx);
    const grants = await Promise.all(
      input.roles.map(async (r) => ({
        role: r.role,
        orgUnitId: await this.unitId(r.role, r.orgUnitCode),
      })),
    );
    const passwordHash = await hash(input.password, { type: 2 });
    return this.prisma.client.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName: input.fullName,
          email: input.email,
          phoneE164: input.phone ?? null,
          passwordHash,
          status: 'ACTIVE',
        },
      });
      for (const grant of grants)
        await tx.userRoleGrant.create({
          data: { userId: user.id, ...grant, grantedByUserId: actor.userId },
        });
      await this.audit.record(tx, ctx, {
        action: 'admin.user_create',
        entityType: 'user',
        entityId: user.id,
        after: { roles: grants.map((g) => g.role) },
      });
      return { id: user.id };
    });
  }

  async createLawyer(input: z.infer<typeof createLawyerSchema>, ctx: RequestContext) {
    const actor = requireActor(ctx);
    const nationalId = normalizeNationalId(input.nationalId);
    if (!nationalId) throw new AppError('VALIDATION', {}, ['nationalId']);
    const branch = await this.prisma.client.organizationalUnit.findFirst({
      where: { unitType: 'REGIONAL_BRANCH', governorate: input.branchGovernorate },
    });
    if (!branch) throw new AppError('VALIDATION', {}, ['branchGovernorate']);
    const sealed = this.secrets.keyRing.seal(Buffer.from(nationalId, 'utf8'));
    const passwordHash = await hash(input.password, { type: 2 });
    return this.prisma.client.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName: input.fullName,
          email: input.email ?? null,
          phoneE164: input.phone,
          passwordHash,
          status: 'ACTIVE',
        },
      });
      await tx.userRoleGrant.create({
        data: { userId: user.id, role: 'LAWYER', grantedByUserId: actor.userId },
      });
      await tx.lawyerProfile.create({
        data: {
          userId: user.id,
          registrationNumber: input.registrationNumber,
          nationalIdHmac: Uint8Array.from(this.secrets.pepper.hmac(nationalId)),
          nationalIdEnc: Uint8Array.from(sealed.box),
          nationalIdKeyId: sealed.keyId,
          branchId: branch.id,
          practiceStatus: input.practiceStatus,
        },
      });
      await this.audit.record(tx, ctx, {
        action: 'admin.lawyer_create',
        entityType: 'user',
        entityId: user.id,
        after: { registrationNumber: input.registrationNumber },
      });
      return { id: user.id };
    });
  }

  async grant(userId: string, input: z.infer<typeof grantRoleSchema>, ctx: RequestContext) {
    const actor = requireActor(ctx);
    const orgUnitId = await this.unitId(input.role, input.orgUnitCode);
    return this.prisma.client.$transaction(async (tx) => {
      const grant = await tx.userRoleGrant.create({
        data: { userId, role: input.role, orgUnitId, grantedByUserId: actor.userId },
      });
      await this.audit.record(tx, ctx, {
        action: 'admin.role_grant',
        entityType: 'user',
        entityId: userId,
        after: { role: input.role },
      });
      return { grantId: grant.id };
    });
  }

  async revoke(grantId: string, ctx: RequestContext) {
    return this.prisma.client.$transaction(async (tx) => {
      const grant = await tx.userRoleGrant.findUnique({ where: { id: grantId } });
      if (!grant || grant.revokedAt) throw new AppError('NOT_FOUND');
      await tx.userRoleGrant.update({ where: { id: grantId }, data: { revokedAt: new Date() } });
      await this.audit.record(tx, ctx, {
        action: 'admin.role_revoke',
        entityType: 'user',
        entityId: grant.userId,
        before: { role: grant.role },
      });
      return { ok: true };
    });
  }

  async setStatus(
    userId: string,
    status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED',
    ctx: RequestContext,
  ) {
    return this.prisma.client.$transaction(async (tx) => {
      const user = await tx.user.update({ where: { id: userId }, data: { status } });
      if (status !== 'ACTIVE') {
        await tx.session.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date(), revokedReason: 'ACCOUNT_STATUS' },
        });
      }
      await this.audit.record(tx, ctx, {
        action: 'admin.user_status',
        entityType: 'user',
        entityId: user.id,
        after: { status },
      });
      return { ok: true };
    });
  }

  async unlock(userId: string, ctx: RequestContext) {
    return this.prisma.client.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { lockedUntil: null, failedLoginCount: 0 },
      });
      await this.audit.record(tx, ctx, {
        action: 'admin.user_unlock',
        entityType: 'user',
        entityId: userId,
      });
      return { ok: true };
    });
  }

  /** Lost authenticator: the user must enrol again at next sign-in. */
  async resetMfa(userId: string, ctx: RequestContext) {
    return this.prisma.client.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { mfaEnabledAt: null, mfaTotpSecretEnc: null, mfaKeyId: null, mfaLastStep: null },
      });
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'MFA_RESET' },
      });
      await this.audit.record(tx, ctx, {
        action: 'admin.mfa_reset',
        entityType: 'user',
        entityId: userId,
      });
      return { ok: true };
    });
  }
}

@Roles('SYSTEM_ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  list() {
    return this.admin.list();
  }

  @Idempotent('admin.create-staff')
  @Post('users')
  createStaff(
    @Body(new ZodPipe(createStaffSchema)) body: z.infer<typeof createStaffSchema>,
    @Ctx() ctx: RequestContext,
  ) {
    return this.admin.createStaff(body, ctx);
  }

  @Idempotent('admin.create-lawyer')
  @Post('lawyers')
  createLawyer(
    @Body(new ZodPipe(createLawyerSchema)) body: z.infer<typeof createLawyerSchema>,
    @Ctx() ctx: RequestContext,
  ) {
    return this.admin.createLawyer(body, ctx);
  }

  @Idempotent('admin.grant')
  @Post('users/:id/roles')
  grant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(grantRoleSchema)) body: z.infer<typeof grantRoleSchema>,
    @Ctx() ctx: RequestContext,
  ) {
    return this.admin.grant(id, body, ctx);
  }

  @Idempotent('admin.revoke')
  @Post('roles/:grantId/revoke')
  @HttpCode(200)
  revoke(@Param('grantId', ParseUUIDPipe) grantId: string, @Ctx() ctx: RequestContext) {
    return this.admin.revoke(grantId, ctx);
  }

  @Idempotent('admin.status')
  @Post('users/:id/status')
  @HttpCode(200)
  status(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(userStatusSchema)) body: z.infer<typeof userStatusSchema>,
    @Ctx() ctx: RequestContext,
  ) {
    return this.admin.setStatus(id, body.status, ctx);
  }

  @Idempotent('admin.unlock')
  @Post('users/:id/unlock')
  @HttpCode(200)
  unlock(@Param('id', ParseUUIDPipe) id: string, @Ctx() ctx: RequestContext) {
    return this.admin.unlock(id, ctx);
  }

  @Idempotent('admin.reset-mfa')
  @Post('users/:id/reset-mfa')
  @HttpCode(200)
  resetMfa(@Param('id', ParseUUIDPipe) id: string, @Ctx() ctx: RequestContext) {
    return this.admin.resetMfa(id, ctx);
  }
}

@Module({ controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
