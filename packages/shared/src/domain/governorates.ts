/**
 * The 14 governorates of the Syrian Arab Republic. Each one hosts a regional
 * branch council of the Bar Association, seeded in Phase 1.
 * Display names live in locales/ar.json under `governorates.<CODE>`.
 */
export const GOVERNORATES = [
  'DAMASCUS',
  'RIF_DIMASHQ',
  'ALEPPO',
  'HOMS',
  'HAMA',
  'LATAKIA',
  'TARTUS',
  'IDLIB',
  'RAQQA',
  'DEIR_EZ_ZOR',
  'HASAKAH',
  'DARAA',
  'SUWAYDA',
  'QUNEITRA',
] as const;

export type Governorate = (typeof GOVERNORATES)[number];
