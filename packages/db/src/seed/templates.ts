import { NOTIFICATION_TEMPLATE_CODES, rawMessage } from '@sba/shared';

import type { NotificationChannel } from '../generated/prisma/enums.js';

export interface TemplateContent {
  readonly code: string;
  readonly channel: NotificationChannel;
  readonly subject: string | null;
  readonly body: string;
}

export interface ActiveTemplate extends TemplateContent {
  readonly id: string;
  readonly version: number;
}

export type TemplatePlan =
  | { readonly kind: 'unchanged'; readonly desired: TemplateContent }
  | { readonly kind: 'create'; readonly desired: TemplateContent; readonly version: number }
  | {
      readonly kind: 'supersede';
      readonly desired: TemplateContent;
      readonly retireId: string;
      readonly version: number;
    };

/** The wording in locales/ar.json, for every code on SMS and e-mail. */
export function desiredTemplates(): TemplateContent[] {
  return NOTIFICATION_TEMPLATE_CODES.flatMap((code) => [
    { code, channel: 'SMS' as const, subject: null, body: rawMessage(`notifications.${code}.sms`) },
    {
      code,
      channel: 'EMAIL' as const,
      subject: rawMessage(`notifications.${code}.emailSubject`),
      body: rawMessage(`notifications.${code}.emailBody`),
    },
  ]);
}

/**
 * Templates are never edited in place (decision D13): changed wording becomes a
 * new version and the previous one is retired, so every sent message can be
 * traced to the exact text that was approved at the time.
 */
export function planTemplate(
  desired: TemplateContent,
  active: ActiveTemplate | undefined,
  highestVersion: number,
): TemplatePlan {
  if (!active) {
    return { kind: 'create', desired, version: highestVersion + 1 };
  }
  if (active.subject === desired.subject && active.body === desired.body) {
    return { kind: 'unchanged', desired };
  }
  return { kind: 'supersede', desired, retireId: active.id, version: highestVersion + 1 };
}
