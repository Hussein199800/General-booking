import { t } from '@/i18n';

const PHRASES = [
  t('home.marquee.human'),
  t('home.marquee.noSlots'),
  t('home.marquee.overlap'),
  t('home.marquee.audit'),
  t('home.marquee.mfa'),
  t('home.marquee.rbac'),
  t('home.marquee.arabic'),
];

/**
 * A slow ribbon of the system's principles. The list is read once by screen
 * readers; the copy that closes the loop is hidden from them. Pauses on hover
 * and focus, and stands still for reduced motion.
 */
export function Marquee() {
  return (
    <section
      aria-label={t('home.marquee.label')}
      className="border-y border-line bg-surface py-5 text-navy-900"
    >
      <div className="marquee">
        <div className="marquee-track">
          {[false, true].map((copy) => (
            <ul key={String(copy)} className="marquee-group" aria-hidden={copy || undefined}>
              {PHRASES.map((phrase) => (
                <li key={phrase} className="marquee-item">
                  {phrase}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
