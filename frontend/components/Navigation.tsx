'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/nav/LanguageSwitcher';

interface NavigationProps {
  user: any;
  onLogout?: () => void;
}

const MENU_CONFIG = [
  { key: '3d', nameKey: 'menu3d', descKey: 'menu3dDesc', itemsKey: 'menu3dItems', href: '/3d-map' },
  { key: '2d', nameKey: 'menu2d', descKey: 'menu2dDesc', itemsKey: 'menu2dItems', href: '/2dmap' },
  { key: 'air', nameKey: 'menuAirQuality', descKey: 'menuAirQualityDesc', itemsKey: 'menuAirQualityItems', href: '/air-quality' },
  { key: 'monitors', nameKey: 'menuMonitors', descKey: 'menuMonitorsDesc', itemsKey: 'menuMonitorsItems', href: '/monitors' },
  { key: 'purifiers', nameKey: 'menuPurifiers', descKey: 'menuPurifiersDesc', itemsKey: 'menuPurifiersItems', href: '/purifiers' },
  { key: 'solutions', nameKey: 'menuSolutions', descKey: 'menuSolutionsDesc', itemsKey: 'menuSolutionsItems', href: '/solutions' },
  { key: 'news', nameKey: 'menuNews', descKey: 'menuNewsDesc', itemsKey: 'menuNewsItems', href: '/news' },
  { key: 'about', nameKey: 'menuAbout', descKey: 'menuAboutDesc', itemsKey: 'menuAboutItems', href: '/about' },
] as const;

export default function Navigation({ user, onLogout }: NavigationProps) {
  const t = useTranslations('nav');
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
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

  return (
    <nav className="wise-nav sticky top-0 z-50 border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14 md:h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2 md:space-x-3 group" onClick={() => setMobileMenuOpen(false)}>
              <div className="relative">
                <div className="w-9 h-9 md:w-10 md:h-10 bg-[#9fe870] rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-105">
                  <span className="text-xl md:text-2xl font-black text-[#163300]">+</span>
                </div>
              </div>
              <span className="text-xl md:text-2xl font-black text-primary">Breez</span>
            </Link>
          </div>

          <div className="hidden lg:flex items-center space-x-1.5">
            {MENU_CONFIG.map((item) => (
              <div
                key={item.key}
                className="relative"
                onMouseEnter={() => setHoveredKey(item.key)}
                onMouseLeave={() => setHoveredKey(null)}
              >
                <Link
                  href={item.href}
                  className="px-3.5 py-2 text-[14px] font-semibold leading-[1.5] text-secondary hover:text-primary rounded-full hover:bg-[rgba(211,242,192,0.18)] transition-all duration-200 relative group"
                >
                  {t(item.nameKey)}
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-green-400 to-emerald-400 group-hover:w-full transition-all duration-300"></span>
                </Link>
                {hoveredKey === item.key && (
                  <div className="absolute top-full left-0 mt-2 w-72 wise-card-strong rounded-[30px] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-4 border-b border-theme">
                      <h3 className="text-primary font-bold text-lg mb-1">{t(item.nameKey)}</h3>
                      <p className="text-muted text-sm">{t(item.descKey)}</p>
                    </div>
                    <div className="p-2">
                      {(t.raw(item.itemsKey) as string[]).map((subItem, i) => (
                        <Link key={i} href={item.href} className="block px-4 py-2.5 text-secondary hover:text-primary hover:bg-green-500/10 rounded-full transition-all duration-200 text-sm">
                          {subItem}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center space-x-2 md:space-x-3">
            <LanguageSwitcher />
            {user?.role === 'admin' && (
              <Link
                href="/admin"
                className="hidden lg:inline-flex wise-btn-secondary px-3.5 py-2 text-[14px]"
              >
                {t('admin')}
              </Link>
            )}
            <button className="text-secondary hover:text-primary transition-colors hidden md:block p-1.5" aria-label="Search">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            {user ? (
              <div className="flex items-center space-x-2 md:space-x-3">
                <Link
                  href="/sensors"
                  className="wise-btn-secondary px-3 md:px-3.5 py-1.5 md:py-2 text-[13px] md:text-[14px]"
                >
                  <span className="hidden sm:inline">🛒 {t('sensors')}</span>
                  <span className="sm:hidden">🛒</span>
                </Link>
                <div className="wise-btn-secondary px-2 md:px-3 py-1.5 md:py-2">
                  <span className="text-[12px] md:text-[13px] font-semibold hidden sm:inline">{t('hello', { name: user.name })}</span>
                  <span className="text-[12px] font-semibold sm:hidden">{user.name.split(' ')[0]}</span>
                </div>
                <button
                  onClick={() => onLogout?.()}
                  className="wise-btn-secondary px-3 md:px-4 py-1.5 md:py-2 text-[13px] md:text-[14px]"
                >
                  <span className="hidden sm:inline">{t('logout')}</span>
                  <span className="sm:hidden">✕</span>
                </button>
              </div>
            ) : (
              <Link
                href="/"
                className="wise-btn px-4 md:px-5 py-2 text-[13px] md:text-[14px]"
              >
                {t('login')}
              </Link>
            )}
            <button
              onClick={toggleTheme}
              className="wise-btn-secondary h-9 w-9 text-sm"
              aria-label="Toggle theme"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? '☾' : '☀'}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden text-secondary hover:text-primary p-2"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} aria-hidden />
            <div className="absolute right-0 top-0 h-full w-full bg-surface border-l border-theme shadow-2xl">
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between p-4 border-b border-theme flex-shrink-0">
                  <div className="flex items-center space-x-2">
                    <div className="w-9 h-9 bg-[#9fe870] rounded-full flex items-center justify-center">
                      <span className="text-xl font-black text-[#163300]">+</span>
                    </div>
                    <span className="text-xl font-black text-primary">Breez</span>
                  </div>
                  <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-secondary hover:text-primary hover:bg-green-500/10 rounded-full transition-all active:scale-95" aria-label="Close menu">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
                  <div className="py-4 px-4 space-y-2">
                    <div className="px-4 pb-2">
                      <LanguageSwitcher />
                    </div>
                    {user?.role === 'admin' && (
                      <Link href="/admin" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-4 rounded-[24px] bg-green-500/15 border border-green-500/30 text-primary font-semibold text-lg hover:bg-green-500/25 transition">
                        {t('admin')}
                      </Link>
                    )}
                    {MENU_CONFIG.map((item) => {
                      const isExpanded = expandedKeys[item.key] || false;
                      const items = t.raw(item.itemsKey) as string[];
                      return (
                        <div key={item.key} className="border-b border-theme last:border-0 pb-2">
                          <div className="flex items-center">
                            <Link
                              href={item.href}
                              onClick={() => setMobileMenuOpen(false)}
                              className="flex-1 px-4 py-4 text-primary hover:text-primary font-bold text-lg rounded-[24px] hover:bg-green-500/10 transition-all duration-200 active:bg-green-500/20 min-h-[56px] flex items-center"
                            >
                              {t(item.nameKey)}
                            </Link>
                            <button
                              onClick={() => setExpandedKeys((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                              className="p-3 ml-2 text-secondary hover:text-primary hover:bg-green-500/10 transition-all rounded-full active:scale-95 min-w-[48px] min-h-[48px] flex items-center justify-center"
                              aria-expanded={isExpanded}
                            >
                              <svg className={`w-6 h-6 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </div>
                          {isExpanded && items?.length > 0 && (
                            <div className="pl-4 pr-2 pb-2 pt-2 space-y-2">
                              {items.map((subItem, i) => (
                                <Link key={i} href={item.href} onClick={() => setMobileMenuOpen(false)} className="flex px-4 py-3 text-secondary hover:text-primary hover:bg-green-500/5 rounded-full transition-all duration-200 text-base active:bg-green-500/10 min-h-[48px] items-center">
                                  {subItem}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="p-4 border-t border-theme flex-shrink-0">
                  {user ? (
                    <div className="space-y-2">
                      <div className="wise-btn-secondary px-4 py-2 text-center w-full">
                        <span className="text-sm font-medium">{user.name}</span>
                      </div>
                      <button
                        onClick={() => { onLogout?.(); setMobileMenuOpen(false); }}
                        className="w-full wise-btn-secondary px-4 py-3 text-sm active:scale-95 min-h-[48px]"
                      >
                        {t('logout')}
                      </button>
                    </div>
                  ) : (
                    <Link href="/" onClick={() => setMobileMenuOpen(false)} className="wise-btn flex w-full px-4 py-3 text-sm text-center active:scale-95 min-h-[48px] items-center justify-center">
                      {t('login')}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
