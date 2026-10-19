'use client';

import { LogIn, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Seal } from '@/components/Seal';
import { t } from '@/i18n';

const LINKS = [
  { href: '/#services', label: 'site.nav.services' },
  { href: '/#journey', label: 'site.nav.journey' },
  { href: '/#roles', label: 'site.nav.roles' },
  { href: '/#guarantees', label: 'site.nav.guarantees' },
  { href: '/#faq', label: 'site.nav.faq' },
] as const;

/**
 * Public header: transparent over the dark landing hero (`tone="night"`),
 * frosted glass once the page scrolls; always solid on inner pages.
 */
export function SiteHeader({ tone = 'day' }: { readonly tone?: 'day' | 'night' }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const light = tone === 'night' && !scrolled && !open;

  return (
    <header
      className="site-header"
      data-scrolled={scrolled || open ? 'true' : 'false'}
      data-solid={tone === 'day' ? 'true' : 'false'}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-3" aria-label={t('nav.home')}>
          <Seal
            id="site"
            className={`size-11 shrink-0 transition-colors ${light ? 'text-gold-300' : 'text-navy-800'}`}
          />
          <span className="min-w-0 leading-tight">
            <span
              className={`block truncate text-xs ${light ? 'text-navy-100' : 'text-ink-muted'}`}
            >
              {t('app.institutionName')}
            </span>
            <span className={`block truncate font-bold ${light ? 'text-white' : 'text-ink'}`}>
              {t('app.shortName')}
            </span>
          </span>
        </Link>

        <nav
          aria-label={t('site.nav.label')}
          className={`ms-auto hidden items-center gap-6 text-sm lg:flex ${light ? 'text-navy-100' : 'text-ink-muted'}`}
        >
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="site-link hover:text-current">
              {t(link.label)}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-2 lg:ms-0">
          <Link
            href="/login"
            className={`btn hidden min-h-10 text-sm sm:inline-flex ${light ? 'btn-glass' : 'btn-primary'}`}
          >
            <LogIn className="size-4" aria-hidden="true" />
            {t('site.signIn')}
          </Link>
          <button
            type="button"
            className={`grid size-11 place-items-center rounded-xl border lg:hidden ${
              light ? 'border-white/20 text-white' : 'border-line bg-surface text-navy-800'
            }`}
            aria-label={open ? t('nav.closeMenu') : t('nav.openMenu')}
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => {
              setOpen((value) => !value);
            }}
          >
            {open ? (
              <X className="size-5" aria-hidden="true" />
            ) : (
              <Menu className="size-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="site-menu"
          aria-label={t('site.nav.label')}
          className="mx-auto grid max-w-7xl gap-1 border-t border-line px-4 pt-2 pb-4 lg:hidden"
        >
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="nav-item font-bold"
              onClick={() => {
                setOpen(false);
              }}
            >
              {t(link.label)}
            </Link>
          ))}
          <Link href="/request" className="nav-item font-bold">
            {t('home.services.audienceRequest')}
          </Link>
          <Link href="/login" className="btn btn-primary mt-2">
            <LogIn className="size-4" aria-hidden="true" />
            {t('site.signIn')}
          </Link>
        </nav>
      )}
    </header>
  );
}
