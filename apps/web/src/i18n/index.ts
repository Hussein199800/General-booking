/**
 * Single entry point for user-facing strings in the web app. All Arabic text
 * comes from packages/shared/locales/ar.json via `t()`; components must not
 * contain Arabic literals (enforced by ESLint).
 */
export {
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelative,
  formatTime,
  t,
  type MessageKey,
} from '@sba/shared';
