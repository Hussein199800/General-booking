import { describe, expect, it } from 'vitest';

import ar from '../../locales/ar.json' with { type: 'json' };
import { placeholdersOf } from '../i18n.js';
import { NOTIFICATION_TEMPLATE_CODES } from './notifications.js';
import {
  APPOINTMENT_TRANSITIONS,
  MFA_REQUIRED_ROLES,
  REQUESTER_TYPES,
  TICKET_KINDS,
  TICKET_TRANSITIONS,
  canTransitionAppointment,
  canTransitionTicket,
  defaultPriority,
} from './workflow.js';

describe('ticket state machine', () => {
  it('never lets a grievance reach the Grand Syndic agenda', () => {
    for (const targets of Object.values(TICKET_TRANSITIONS.GRIEVANCE)) {
      expect(targets).not.toContain('APPROVED');
    }
  });

  it('has no way out of terminal states', () => {
    for (const kind of TICKET_KINDS) {
      for (const terminal of ['DECLINED', 'WITHDRAWN', 'CLOSED'] as const) {
        expect(TICKET_TRANSITIONS[kind][terminal]).toBeUndefined();
      }
    }
  });

  it('answers transition queries', () => {
    expect(canTransitionTicket('AUDIENCE_REQUEST', 'PENDING_REVIEW', 'APPROVED')).toBe(true);
    expect(canTransitionTicket('GRIEVANCE', 'PENDING_REVIEW', 'APPROVED')).toBe(false);
    expect(canTransitionTicket('AUDIENCE_REQUEST', 'PENDING_REVIEW', 'CLOSED')).toBe(false);
  });
});

describe('appointment state machine', () => {
  it('only SCHEDULED and POSTPONED have exits', () => {
    expect(Object.keys(APPOINTMENT_TRANSITIONS).sort()).toEqual(['POSTPONED', 'SCHEDULED']);
    expect(canTransitionAppointment('POSTPONED', 'SCHEDULED')).toBe(false);
  });
});

describe('roles and priority', () => {
  it('requires MFA for every role except lawyers', () => {
    expect(MFA_REQUIRED_ROLES.has('LAWYER')).toBe(false);
    expect(MFA_REQUIRED_ROLES.has('GRAND_SYNDIC')).toBe(true);
    expect(MFA_REQUIRED_ROLES.has('SECRETARIAT_OFFICER')).toBe(true);
    expect(MFA_REQUIRED_ROLES.has('SYSTEM_ADMIN')).toBe(true);
  });

  it('derives a priority for every requester type', () => {
    expect(REQUESTER_TYPES.map(defaultPriority)).toEqual([
      'STANDARD',
      'INTERNAL',
      'CRITICAL',
      'CRITICAL',
      'STANDARD',
      'STANDARD',
    ]);
  });
});

describe('notification templates', () => {
  it('has SMS, e-mail subject and e-mail body for every code', () => {
    expect(Object.keys(ar.notifications).sort()).toEqual([...NOTIFICATION_TEMPLATE_CODES].sort());
    for (const code of NOTIFICATION_TEMPLATE_CODES) {
      const template = ar.notifications[code];
      expect(template.sms.length).toBeGreaterThan(0);
      expect(template.emailSubject.length).toBeGreaterThan(0);
      expect(template.emailBody.length).toBeGreaterThan(0);
    }
  });

  it('keeps every SMS within 3 Arabic (UCS-2) segments', () => {
    for (const code of NOTIFICATION_TEMPLATE_CODES) {
      // 3 concatenated UCS-2 segments = 201 characters, before placeholders expand.
      expect(ar.notifications[code].sms.length, code).toBeLessThanOrEqual(201);
    }
  });

  it('uses the same placeholders in SMS and e-mail, except the e-mail-only details', () => {
    for (const code of NOTIFICATION_TEMPLATE_CODES) {
      const template = ar.notifications[code];
      const email = new Set([
        ...placeholdersOf(template.emailSubject),
        ...placeholdersOf(template.emailBody),
      ]);
      for (const name of placeholdersOf(template.sms)) {
        expect(email, `${code}: {{${name}}}`).toContain(name);
      }
    }
  });
});
