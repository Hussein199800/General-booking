/**
 * The six institutional bodies the system serves or coordinates with.
 * Codes are stable identifiers used in code, the database and audit logs;
 * display names live in locales/ar.json under `entities.<CODE>`.
 */
export const ADMINISTRATIVE_ENTITIES = [
  'GRAND_SYNDIC',
  'CENTRAL_SECRETARIAT',
  'REGIONAL_BRANCH',
  'DISCIPLINARY_COMMITTEE',
  'MINISTRY_OF_JUSTICE',
  'SUPREME_JUDICIAL_COUNCIL',
] as const;

export type AdministrativeEntity = (typeof ADMINISTRATIVE_ENTITIES)[number];
