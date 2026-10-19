import { Reveal } from '@/components/Reveal';

export function SectionHeading({
  id,
  eyebrow,
  title,
  lede,
  tone = 'day',
}: {
  readonly id: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly lede?: string;
  readonly tone?: 'day' | 'night';
}) {
  return (
    <Reveal className="grid max-w-3xl gap-3">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id} className={`headline ${tone === 'night' ? 'text-white' : 'text-ink'}`}>
        {title}
      </h2>
      {lede && (
        <p className={`lede ${tone === 'night' ? 'text-navy-200' : 'text-ink-muted'}`}>{lede}</p>
      )}
    </Reveal>
  );
}
