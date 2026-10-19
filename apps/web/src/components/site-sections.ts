import { t } from '@/i18n';

/** Sections of the home page, in order, linked from the header and the footer. */
export const SITE_SECTIONS = [
  { id: 'services', label: t('nav.services') },
  { id: 'process', label: t('nav.process') },
  { id: 'directory', label: t('nav.directory') },
  { id: 'guarantees', label: t('nav.guarantees') },
  { id: 'faq', label: t('nav.faq') },
] as const;
