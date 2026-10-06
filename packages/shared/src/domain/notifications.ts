/**
 * Codes of the Arabic notification templates. Wording lives in
 * locales/ar.json under `notifications.<CODE>` (sms, emailSubject, emailBody)
 * and is copied into notification_templates by the database seed.
 */
export const NOTIFICATION_TEMPLATE_CODES = [
  'REQUEST_RECEIVED',
  'APPOINTMENT_CONFIRMED_IN_PERSON',
  'APPOINTMENT_CONFIRMED_REMOTE',
  'APPOINTMENT_TRANSFERRED',
  'REQUEST_DELEGATED',
  'REQUEST_DECLINED',
  'DOCUMENTS_REQUESTED',
  'DOCUMENTS_REMINDER',
  'EMERGENCY_APOLOGY',
] as const;
export type NotificationTemplateCode = (typeof NOTIFICATION_TEMPLATE_CODES)[number];
