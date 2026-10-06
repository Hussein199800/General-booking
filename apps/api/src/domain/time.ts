/** Syria observes UTC+3 all year (since 2022). */
const DAMASCUS_OFFSET_MS = 3 * 3_600_000;

/** yyyy-mm-dd of the Damascus calendar day of an instant. */
export function damascusDay(instant: Date): string {
  return new Date(instant.getTime() + DAMASCUS_OFFSET_MS).toISOString().slice(0, 10);
}

/** A `date` column value (UTC midnight) for the Damascus day of an instant. */
export function agendaDate(instant: Date): Date {
  return new Date(`${damascusDay(instant)}T00:00:00Z`);
}

/** Start of the Damascus day containing `instant`, as a UTC instant. */
export function startOfDamascusDay(instant: Date): Date {
  return new Date(Date.parse(`${damascusDay(instant)}T00:00:00Z`) - DAMASCUS_OFFSET_MS);
}

export function sameDamascusDay(a: Date, b: Date): boolean {
  return damascusDay(a) === damascusDay(new Date(b.getTime() - 1));
}
