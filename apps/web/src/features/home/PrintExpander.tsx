'use client';

import { useEffect } from 'react';

/**
 * Opens every `details[data-print-open]` while printing and restores the
 * reader's choice afterwards (for browsers without `::details-content`).
 */
export function PrintExpander() {
  useEffect(() => {
    let opened: HTMLDetailsElement[] = [];
    const before = () => {
      opened = [
        ...document.querySelectorAll<HTMLDetailsElement>('details[data-print-open]'),
      ].filter((item) => !item.open);
      for (const item of opened) item.open = true;
    };
    const after = () => {
      for (const item of opened) item.open = false;
      opened = [];
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);
  return null;
}
