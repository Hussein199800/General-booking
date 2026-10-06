import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  changePasswordSchema,
  lawyerLoginSchema,
  mfaConfirmSchema,
  staffLoginSchema,
  type LawyerLoginInput,
  type LoginOutcome,
  type MeResponse,
  type StaffLoginInput,
} from '@sba/shared';
import type { Request, Response } from 'express';
import type { z } from 'zod';

import { AppError } from '../common/app-error.js';
import { Ctx, type RequestContext } from '../common/request-context.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { APP_ENV } from '../config/config.module.js';
import { AUTH_THROTTLE } from '../config/rate-limits.js';
import type { Env } from '../config/env.js';
import { AuthService, type LoginResult } from './auth.service.js';
import { clearSessionCookies, REFRESH_COOKIE, setSessionCookies } from './cookies.js';
import { AllowWithoutMfa, Public } from './decorators.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_ENV) private readonly env: Env,
  ) {}

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('staff/login')
  @HttpCode(200)
  async staffLogin(
    @Body(new ZodPipe(staffLoginSchema)) body: StaffLoginInput,
    @Ctx() ctx: RequestContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginOutcome> {
    return this.finish(await this.auth.staffLogin(body, ctx), res);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('lawyer/login')
  @HttpCode(200)
  async lawyerLogin(
    @Body(new ZodPipe(lawyerLoginSchema)) body: LawyerLoginInput,
    @Ctx() ctx: RequestContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginOutcome> {
    return this.finish(await this.auth.lawyerLogin(body, ctx), res);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(204)
  async refresh(
    @Req() req: Request,
    @Ctx() ctx: RequestContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookies = req.cookies as Record<string, string | undefined>;
    try {
      setSessionCookies(res, this.env, await this.auth.refresh(cookies[REFRESH_COOKIE], ctx));
    } catch (error) {
      if (error instanceof AppError) clearSessionCookies(res, this.env);
      throw error;
    }
  }

  @AllowWithoutMfa()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Ctx() ctx: RequestContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(ctx);
    clearSessionCookies(res, this.env);
  }

  @AllowWithoutMfa()
  @Get('me')
  me(@Ctx() ctx: RequestContext): Promise<MeResponse> {
    if (!ctx.actor) throw new AppError('UNAUTHENTICATED');
    return this.auth.me(ctx.actor);
  }

  @AllowWithoutMfa()
  @Post('mfa/enroll')
  @HttpCode(200)
  startEnrollment(@Ctx() ctx: RequestContext) {
    return this.auth.startMfaEnrollment(ctx);
  }

  @AllowWithoutMfa()
  @Throttle(AUTH_THROTTLE)
  @Post('mfa/confirm')
  @HttpCode(204)
  async confirmEnrollment(
    @Body(new ZodPipe(mfaConfirmSchema)) body: z.infer<typeof mfaConfirmSchema>,
    @Ctx() ctx: RequestContext,
  ): Promise<void> {
    await this.auth.confirmMfaEnrollment(body.otp, ctx);
  }

  @Throttle(AUTH_THROTTLE)
  @Post('password')
  @HttpCode(204)
  async changePassword(
    @Body(new ZodPipe(changePasswordSchema)) body: z.infer<typeof changePasswordSchema>,
    @Ctx() ctx: RequestContext,
  ): Promise<void> {
    await this.auth.changePassword(body.currentPassword, body.newPassword, ctx);
  }

  private finish(result: LoginResult, res: Response): LoginOutcome {
    if (result.tokens) setSessionCookies(res, this.env, result.tokens);
    return result.outcome;
  }
}
