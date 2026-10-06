'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

import { t } from '@/i18n';

/** Native <dialog> (focus trap, Escape, backdrop) with the house style. */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-label={title}>
      <div className="grid gap-4 p-5 sm:p-6">
        <header className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            type="button"
            className="btn btn-secondary min-h-10 px-3"
            aria-label={t('secretariat.detail.close')}
            onClick={() => ref.current?.close()}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>
        <div className="grid gap-4">{children}</div>
      </div>
    </dialog>
  );
}
