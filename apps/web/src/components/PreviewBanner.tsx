import { FlaskConical } from 'lucide-react';

import { t } from '@/i18n';

/** Shown on every screen backed by demo data, in every build. */
export function PreviewBanner() {
  return (
    <div
      role="note"
      className="flex items-center gap-2 rounded-xl border border-gold-300 bg-gold-50 px-4 py-2 text-sm font-bold text-gold-700"
    >
      <FlaskConical className="size-4 shrink-0" aria-hidden="true" />
      <span>{t('preview.banner')}</span>
    </div>
  );
}
