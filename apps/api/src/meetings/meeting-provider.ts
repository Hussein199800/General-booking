import { randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { AppError } from '../common/app-error.js';
import { APP_ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';

export interface MeetingLink {
  readonly provider: string;
  readonly url: string;
  readonly externalId: string;
}

/**
 * Default MeetingProvider: self-hosted Jitsi (hard rule 9). Rooms are created on
 * first join, so a link is an unguessable room name on the Bar's own server.
 * JWT-protected room access (lobby, moderator) is configured on the Jitsi side
 * in Phase 3; until JITSI_PUBLIC_URL is set, remote meetings are refused.
 */
@Injectable()
export class MeetingProvider {
  constructor(
    @Inject(APP_ENV) private readonly env: { JITSI_PUBLIC_URL?: Env['JITSI_PUBLIC_URL'] },
  ) {}

  createMeeting(): MeetingLink {
    const base = this.env.JITSI_PUBLIC_URL;
    if (!base) throw new AppError('MEETING_PROVIDER_UNAVAILABLE');
    const room = `sba-${randomBytes(18).toString('base64url')}`;
    return { provider: 'jitsi', url: `${base.replace(/\/$/, '')}/${room}`, externalId: room };
  }
}
