'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/nav/LanguageSwitcher';

interface NavigationProps {
  user: any;
  onLogout?: () => void;
}

const PRIMARY_LINKS = [
  { key: '3d', nameKey: 'menu3d', href: '/3d-map' },
  { key: '2d', nameKey: 'menu2d', href: '/2dmap' },
  { key: 'air', nameKey: 'menuAirQuality', href: '/air-quality' },
  { key: 'sensors', nameKey: 'sensors', href: '/sensors' },
] as const;

const MORE_LINKS = [
  { key: 'monitors', nameKey: 'menuMonitors', descKey: 'menuMonitorsDesc', href: '/monitors' },
  { key: 'purifiers', nameKey: 'menuPurifiers', descKey: 'menuPurifiersDesc', href: '/purifiers' },
  { key: 'solutions', nameKey: 'menuSolutions', descKey: 'menuSolutionsDesc', href: '/solutions' },
  { key: 'news', nameKey: 'menuNews', descKey: 'menuNewsDesc', href: '/news' },
  { key: 'about', nameKey: 'menuAbout', descKey: 'menuAboutDesc', href: '/about' },
] as const;

export default function Navigation({ user, onLogout }: NavigationProps) {
  const t = useTranslations('nav');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const current = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    setTheme(current);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    document.documentElement.classList.toggle('dark', next === 'dark');
    localStorage.setItem('breez-theme', next);
    setTheme(next);
  };

  const closeMenus = () => {
    setMobileMenuOpen(false);
    setMoreOpen(false);
    setUserMenuOpen(false);
  };

  const handleLogout = () => {
    closeMenus();
    onLogout?.();
  };

  return (
    <nav className="wise-nav sticky top-0 z-50 border-b">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-3">
          <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2.5 group" onClick={closeMenus}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#9fe870] transition-transform duration-200 group-hover:scale-105">
              <span className="text-2xl font-black text-[#163300]">+</span>
            </div>
            <span className="truncate text-xl font-black text-primary sm:text-2xl">Breez</span>
          </Link>

          <div className="hidden min-w-0 flex-1 items-center justify-center gap-1 xl:flex">
            {PRIMARY_LINKS.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="flex h-10 max-w-[9.5rem] items-center rounded-full px-3.5 text-sm font-bold text-secondary transition hover:bg-[var(--surface-muted)] hover:text-primary"
                title={t(item.nameKey)}
              >
                <span className="truncate">{t(item.nameKey)}</span>
              </Link>
            ))}

            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen((open) => !open)}
                onBlur={() => window.setTimeout(() => setMoreOpen(false), 120)}
                className="flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-bold text-secondary transition hover:bg-[var(--surface-muted)] hover:text-primary"
                aria-expanded={moreOpen}
              >
                <span>{t('more')}</span>
                <svg className={`h-4 w-4 transition-transform ${moreOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </button>

              {moreOpen ? (
                <div className="absolute left-1/2 top-full mt-3 w-72 -translate-x-1/2 rounded-2xl border border-theme bg-surface p-2 shadow-2xl">
                  {MORE_LINKS.map((item) => (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={closeMenus}
                      className="block rounded-xl px-4 py-3 transition hover:bg-[var(--surface-muted)]"
                    >
                      <span className="block truncate text-sm font-black text-primary">{t(item.nameKey)}</span>
                      <span className="mt-1 block max-h-10 overflow-hidden text-xs leading-5 text-muted">{t(item.descKey)}</span>
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>

            {user?.role === 'admin' ? (
              <Link
                href="/admin"
                className="flex h-10 max-w-[8rem] items-center rounded-full px-3.5 text-sm font-bold text-secondary transition hover:bg-[var(--surface-muted)] hover:text-primary"
                title={t('admin')}
              >
                <span className="truncate">{t('admin')}</span>
              </Link>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitcher />
            <button
              onClick={toggleTheme}
              className="wise-btn-secondary h-9 w-9 text-sm"
              aria-label="Toggle theme"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? '☾' : '☀'}
            </button>

            {user ? (
              <div className="relative hidden xl:block">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((open) => !open)}
                  onBlur={() => window.setTimeout(() => setUserMenuOpen(false), 120)}
                  className="wise-btn-secondary h-10 max-w-[12rem] gap-2 px-3.5 text-sm"
                  aria-expanded={userMenuOpen}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#9fe870] text-xs font-black text-[#163300]">
                    {(user.name || 'U').slice(0, 1).toUpperCase()}
                  </span>
                  <span className="truncate">{user.name || t('account')}</span>
                </button>

                {userMenuOpen ? (
                  <div className="absolute right-0 top-full mt-3 w-56 rounded-2xl border border-theme bg-surface p-2 shadow-2xl">
                    <div className="border-b border-theme px-3 py-2">
                      <p className="truncate text-sm font-black text-primary">{user.name}</p>
                      <p className="truncate text-xs text-muted">{user.email}</p>
                    </div>
                    <Link href="/sensors" onClick={closeMenus} className="mt-2 block rounded-xl px-3 py-2 text-sm font-bold text-secondary hover:bg-[var(--surface-muted)] hover:text-primary">
                      {t('sensors')}
                    </Link>
                    {user.role === 'admin' ? (
                      <Link href="/admin" onClick={closeMenus} className="block rounded-xl px-3 py-2 text-sm font-bold text-secondary hover:bg-[var(--surface-muted)] hover:text-primary">
                        {t('admin')}
                      </Link>
                    ) : null}
                    <button onClick={handleLogout} className="block w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-secondary hover:bg-[var(--surface-muted)] hover:text-primary">
                      {t('logout')}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <Link href="/" className="wise-btn hidden h-10 px-4 text-sm xl:inline-flex">
                {t('login')}
              </Link>
            )}

            <button
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="wise-btn-secondary h-9 w-9 xl:hidden"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen ? (
        <div className="xl:hidden border-t border-theme bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {[...PRIMARY_LINKS, ...MORE_LINKS].map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={closeMenus}
                  className="flex min-h-12 items-center rounded-xl border border-theme bg-[var(--surface-muted)] px-4 text-sm font-bold text-primary"
                >
                  <span className="truncate">{t(item.nameKey)}</span>
                </Link>
              ))}
              {user?.role === 'admin' ? (
                <Link href="/admin" onClick={closeMenus} className="flex min-h-12 items-center rounded-xl border border-theme bg-[var(--surface-muted)] px-4 text-sm font-bold text-primary">
                  <span className="truncate">{t('admin')}</span>
                </Link>
              ) : null}
            </div>

            <div className="mt-4 rounded-2xl border border-theme bg-surface p-3">
              {user ? (
                <div className="space-y-3">
                  <div>
                    <p className="truncate text-sm font-black text-primary">{user.name}</p>
                    <p className="truncate text-xs text-muted">{user.email}</p>
                  </div>
                  <button onClick={handleLogout} className="wise-btn-secondary h-11 w-full text-sm">
                    {t('logout')}
                  </button>
                </div>
              ) : (
                <Link href="/" onClick={closeMenus} className="wise-btn h-11 w-full text-sm">
                  {t('login')}
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </nav>
  );
}
