'use client';

import { LogIn, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { t } from '@/i18n';

import { Seal } from './Seal';
import { SITE_SECTIONS } from './site-sections';

/**
 * Glass header of the public pages. Over a dark hero (`overlay`) it starts
 * transparent and turns to glass once the page scrolls; without JavaScript it
 * is simply always glass. The phone menu is a native <details> dropdown, so it
 * opens without JavaScript too; the script only closes it after a choice.
 */
export function SiteHeader({ overlay = false }: { readonly overlay?: boolean }) {
  const [atTop, setAtTop] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (!overlay) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      setAtTop(window.scrollY < 24);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [overlay]);

  useEffect(() => {
    const close = () => {
      if (menu.current) menu.current.open = false;
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    const onPointer = (event: PointerEvent) => {
      if (menu.current?.open && !menu.current.contains(event.target as Node)) close();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, []);

  const closeMenu = () => {
    if (menu.current) menu.current.open = false;
  };

  return (
    <header
      className="site-header"
      data-overlay={overlay ? '' : undefined}
      data-at-top={overlay && atTop ? '' : undefined}
    >
      <div className="shell flex h-16 items-center gap-4">
        <Link href="/" className="flex min-w-0 items-center gap-3" aria-label={t('nav.home')}>
          <Seal id="site-header" className="size-10 shrink-0 text-gold-300" />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-bold">{t('app.shortName')}</span>
            <span className="block truncate text-xs text-white/60">{t('app.institutionName')}</span>
          </span>
        </Link>

        <nav aria-label={t('nav.sections')} className="ms-auto hidden items-center gap-1 lg:flex">
          {SITE_SECTIONS.map((section) => (
            <Link key={section.id} href={`/#${section.id}`} className="site-nav-link">
              {section.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/login"
          className="btn btn-glass ms-auto hidden min-h-10 text-sm sm:inline-flex lg:ms-2"
        >
          <LogIn className="size-4" aria-hidden="true" />
          {t('nav.login')}
        </Link>

        <details ref={menu} className="site-menu ms-auto sm:ms-0 lg:hidden">
          <summary className="grid size-11 place-items-center rounded-full border border-white/20 bg-white/5">
            <Menu className="menu-icon-open size-5" aria-hidden="true" />
            <X className="menu-icon-close size-5" aria-hidden="true" />
            <span className="sr-only">{t('nav.menu')}</span>
          </summary>
          <nav aria-label={t('nav.sections')} className="site-menu-panel">
            {SITE_SECTIONS.map((section) => (
              <Link key={section.id} href={`/#${section.id}`} onClick={closeMenu}>
                {section.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={closeMenu}
              className="mt-1 border-t border-white/10 font-bold text-gold-300"
            >
              {t('nav.login')}
            </Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
