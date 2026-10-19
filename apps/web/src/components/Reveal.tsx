'use client';

import { useEffect, useRef, type ElementType, type ReactNode } from 'react';

/**
 * Fades its content in when it scrolls into view (once). The hidden state lives
 * in CSS (`.reveal`), so without JavaScript or with reduced motion nothing stays
 * hidden; this only flips `data-shown`.
 */
export function Reveal({
  as: Tag = 'div',
  delay,
  className = '',
  children,
  ...rest
}: {
  readonly as?: ElementType;
  readonly delay?: 1 | 2 | 3 | 4;
  readonly className?: string;
  readonly children: ReactNode;
  readonly id?: string;
  readonly 'aria-labelledby'?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (!('IntersectionObserver' in window)) {
      element.dataset.shown = 'true';
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            element.dataset.shown = 'true';
            observer.disconnect();
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);
  return (
    <Tag
      ref={ref}
      className={`reveal ${delay ? `reveal-d${String(delay)}` : ''} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
