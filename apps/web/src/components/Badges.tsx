import type { PriorityTier, RequestStatus } from '@sba/shared';

import { t } from '@/i18n';

const PRIORITY_STYLE: Record<PriorityTier, string> = {
  CRITICAL: 'bg-tier-critical-bg text-tier-critical',
  INTERNAL: 'bg-tier-internal-bg text-tier-internal',
  STANDARD: 'bg-tier-standard-bg text-tier-standard',
};

export const PRIORITY_BORDER: Record<PriorityTier, string> = {
  CRITICAL: 'border-s-tier-critical',
  INTERNAL: 'border-s-tier-internal',
  STANDARD: 'border-s-tier-standard',
};

export const PRIORITY_ACCENT: Record<PriorityTier, string> = {
  CRITICAL: 'var(--color-tier-critical)',
  INTERNAL: 'var(--color-tier-internal)',
  STANDARD: 'var(--color-tier-standard)',
};

export function PriorityBadge({ priority }: { priority: PriorityTier }) {
  return (
    <span className={`badge ${PRIORITY_STYLE[priority]}`}>
      <span className="size-2 rounded-full bg-current" aria-hidden="true" />
      {t(`labels.priorityShort.${priority}`)}
    </span>
  );
}

const STATUS_STYLE: Record<RequestStatus, string> = {
  PENDING_REVIEW: 'bg-navy-50 text-navy-700',
  AWAITING_DOCUMENTS: 'bg-gold-50 text-gold-700',
  DELEGATED: 'bg-navy-100 text-navy-800',
  APPROVED: 'bg-tier-standard-bg text-tier-standard',
  DECLINED: 'bg-tier-critical-bg text-tier-critical',
  WITHDRAWN: 'bg-canvas text-ink-muted',
  CLOSED: 'bg-canvas text-ink-muted',
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  return <span className={`badge ${STATUS_STYLE[status]}`}>{t(`labels.status.${status}`)}</span>;
}
