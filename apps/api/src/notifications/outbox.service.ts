import { Injectable } from '@nestjs/common';
import type { Prisma } from '@sba/db';
import { interpolate, type NotificationTemplateCode } from '@sba/shared';

export interface Recipient {
  readonly phone?: string | null;
  readonly email?: string | null;
  readonly userId?: string | null;
}

export interface OutboxMessage {
  readonly code: NotificationTemplateCode;
  readonly recipient: Recipient;
  readonly payload: Record<string, string>;
  readonly ticketId?: string | null;
  readonly appointmentId?: string | null;
  readonly emergencyOverrideId?: string | null;
  /** Makes the enqueue idempotent: the same event never queues twice. */
  readonly dedupeKey: string;
}

/**
 * Transactional outbox (decision D13): notifications are written in the same
 * transaction as the change they announce, with status QUEUED. Delivery
 * (SMS gateway / SMTP workers with retries) is Phase 3 — until then rows stay
 * QUEUED and nothing is sent. This is stated in the UI and the docs.
 */
@Injectable()
export class OutboxService {
  async enqueue(tx: Prisma.TransactionClient, message: OutboxMessage): Promise<number> {
    const channels: { channel: 'SMS' | 'EMAIL'; address: string }[] = [];
    if (message.recipient.phone)
      channels.push({ channel: 'SMS', address: message.recipient.phone });
    if (message.recipient.email)
      channels.push({ channel: 'EMAIL', address: message.recipient.email });

    let queued = 0;
    for (const { channel, address } of channels) {
      const template = await tx.notificationTemplate.findFirst({
        where: { code: message.code, channel, locale: 'ar', isActive: true },
        select: { id: true, subject: true, body: true },
      });
      if (!template) continue; // not seeded: nothing to send on this channel
      const dedupeKey = `${message.dedupeKey}:${channel}`;
      const exists = await tx.notification.findUnique({
        where: { dedupeKey },
        select: { id: true },
      });
      if (exists) continue;
      await tx.notification.create({
        data: {
          channel,
          templateId: template.id,
          recipientUserId: message.recipient.userId ?? null,
          recipientAddress: address,
          payload: message.payload,
          // Rendered now, so the record shows exactly what was (to be) sent.
          renderedSubject: template.subject
            ? interpolate(template.subject, message.payload, message.code)
            : null,
          renderedBody: interpolate(template.body, message.payload, message.code),
          ticketId: message.ticketId ?? null,
          appointmentId: message.appointmentId ?? null,
          emergencyOverrideId: message.emergencyOverrideId ?? null,
          dedupeKey,
        },
      });
      queued += 1;
    }
    return queued;
  }
}
