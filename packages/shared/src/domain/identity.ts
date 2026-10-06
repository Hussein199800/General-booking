const EASTERN_ARABIC_DIGITS = /[٠-٩]/g;

/**
 * Canonical form of a Syrian national number (الرقم الوطني, 11 digits) before
 * it is HMAC'd for lookup: Eastern Arabic digits become Western, everything
 * that is not a digit is dropped. Returns null if the result is not 11 digits.
 */
export function normalizeNationalId(input: string): string | null {
  const digits = input
    .replace(EASTERN_ARABIC_DIGITS, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/\D/g, '');
  return /^\d{11}$/.test(digits) ? digits : null;
}
