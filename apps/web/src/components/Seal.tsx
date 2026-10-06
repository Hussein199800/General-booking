import { t } from '@/i18n';

/** Circular institutional seal with the scales of justice, after the reference portal. */
export function Seal({ id, className = '' }: { id: string; className?: string }) {
  const arc = `seal-arc-${id}`;
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <defs>
        <path id={arc} d="M60,60 m-45,0 a45,45 0 1,1 90,0 a45,45 0 1,1 -90,0" />
      </defs>
      <circle cx="60" cy="60" r="57" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="60" cy="60" r="53" fill="none" stroke="currentColor" strokeWidth="0.8" />
      <circle cx="60" cy="60" r="35" fill="none" stroke="currentColor" strokeWidth="0.8" />
      <text fontSize="9.5" fontWeight="700" fill="currentColor">
        <textPath href={`#${arc}`}>{t('seal.ring')}</textPath>
      </text>
      <g
        transform="translate(60 62) scale(0.52) translate(-50 -50)"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M50 22 V76" />
        <path d="M26 32 H74" />
        <path d="M36 78 H64" />
        <path d="M26 32 L17 54 M26 32 L35 54" />
        <path d="M14 54 Q26 66 38 54 Z" />
        <path d="M74 32 L65 54 M74 32 L83 54" />
        <path d="M62 54 Q74 66 86 54 Z" />
      </g>
    </svg>
  );
}
