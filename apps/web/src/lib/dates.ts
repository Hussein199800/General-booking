/** Syria observes UTC+3 all year (since 2022). */
export const DAMASCUS_OFFSET_MS = 3 * 3_600_000;

/** yyyy-mm-dd of the Damascus calendar day of an instant. */
export function damascusIsoDate(instant: Date): string {
  return new Date(instant.getTime() + DAMASCUS_OFFSET_MS).toISOString().slice(0, 10);
}

/** The instant at hour:minute on a Damascus calendar day (yyyy-mm-dd). */
export function damascusInstant(isoDate: string, hour: number, minute: number): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, hour, minute) - DAMASCUS_OFFSET_MS);
}

export function addDays(isoDate: string, days: number): string {
  return new Date(damascusInstant(isoDate, 12, 0).getTime() + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** A date and an HH:MM time entered in a form, read as Damascus local time. */
export function fromDamascusInput(isoDate: string, time: string): Date {
  return new Date(`${isoDate}T${time}:00+03:00`);
}
