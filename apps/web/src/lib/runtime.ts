/**
 * Demo mode: the GitHub Pages preview (SBA_PREVIEW=1) or an explicit local demo
 * (SBA_DEMO=1). Only then may screens read the browser-only demo store. Real
 * builds talk to the API exclusively and never show demo data (audit P0-1).
 */
export const DEMO_MODE =
  process.env.NEXT_PUBLIC_SBA_PREVIEW === '1' || process.env.NEXT_PUBLIC_SBA_DEMO === '1';
