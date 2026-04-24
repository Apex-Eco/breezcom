'use client';

import { useState } from 'react';
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

  return (
    <nav className="glass-strong border-b border-green-500/20 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14 md:h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2 md:space-x-3 group" onClick={() => setMobileMenuOpen(false)}>
              <div className="relative">
                <div className="w-9 h-9 md:w-10 md:h-10 bg-gradient-to-br from-green-400 via-emerald-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg shadow-green-500/40 transition-all duration-300 group-hover:scale-105">
                  <span className="text-xl md:text-2xl font-black text-white drop-shadow-lg">+</span>
                </div>
                <div className="absolute inset-0 bg-gradient-to-br from-green-400 via-emerald-500 to-cyan-500 rounded-lg blur-lg opacity-45 group-hover:opacity-70 transition-opacity duration-300"></div>
              </div>
              <span className="text-xl md:text-2xl font-[590] bg-gradient-to-r from-green-400 via-emerald-400 to-cyan-400 bg-clip-text text-transparent tracking-[-0.24px]">Breez</span>
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
                  className="px-3.5 py-2 text-[14px] font-[510] leading-[1.5] text-[#d0d6e0] hover:text-[#f7f8f8] rounded-md hover:bg-white/5 transition-all duration-200 relative group"
                >
                  {t(item.nameKey)}
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-green-400 to-emerald-400 group-hover:w-full transition-all duration-300"></span>
                </Link>
                {hoveredKey === item.key && (
                  <div className="absolute top-full left-0 mt-2 w-72 glass-strong rounded-xl border border-green-500/30 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-4 border-b border-green-500/20">
                      <h3 className="text-white font-bold text-lg mb-1">{t(item.nameKey)}</h3>
                      <p className="text-gray-400 text-sm">{t(item.descKey)}</p>
                    </div>
                    <div className="p-2">
                      {(t.raw(item.itemsKey) as string[]).map((subItem, i) => (
                        <Link key={i} href={item.href} className="block px-4 py-2.5 text-gray-300 hover:text-white hover:bg-green-500/10 rounded-lg transition-all duration-200 text-sm">
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
                className="hidden lg:inline-flex px-3.5 py-2 rounded-md bg-green-500/15 border border-green-500/30 text-green-200 text-[14px] font-[510] hover:bg-green-500/25 transition"
              >
                {t('admin')}
              </Link>
            )}
            <button className="text-gray-400 hover:text-green-400 transition-colors hidden md:block p-1.5" aria-label="Search">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            {user ? (
              <div className="flex items-center space-x-2 md:space-x-3">
                <Link
                  href="/sensors"
                  className="px-3 md:px-3.5 py-1.5 md:py-2 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 hover:from-blue-500/30 hover:to-cyan-500/30 border border-blue-500/30 hover:border-blue-500/50 rounded-md text-blue-400 hover:text-blue-300 font-[510] transition-all duration-200 text-[13px] md:text-[14px]"
                >
                  <span className="hidden sm:inline">🛒 {t('sensors')}</span>
                  <span className="sm:hidden">🛒</span>
                </Link>
                <div className="px-2 md:px-3 py-1.5 md:py-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-md">
                  <span className="text-green-400 text-[12px] md:text-[13px] font-[510] hidden sm:inline">{t('hello', { name: user.name })}</span>
                  <span className="text-green-400 text-[12px] font-[510] sm:hidden">{user.name.split(' ')[0]}</span>
                </div>
                <button
                  onClick={() => onLogout?.()}
                  className="px-3 md:px-4 py-1.5 md:py-2 bg-gradient-to-r from-red-500/20 to-pink-500/20 hover:from-red-500/30 hover:to-pink-500/30 text-red-400 hover:text-red-300 font-[510] transition-all duration-200 border border-red-500/30 hover:border-red-500/50 rounded-md text-[13px] md:text-[14px]"
                >
                  <span className="hidden sm:inline">{t('logout')}</span>
                  <span className="sm:hidden">✕</span>
                </button>
              </div>
            ) : (
              <Link
                href="/"
                className="px-4 md:px-5 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-[510] transition-all duration-200 rounded-md shadow-lg shadow-green-500/30 hover:shadow-green-500/50 text-[13px] md:text-[14px]"
              >
                {t('login')}
              </Link>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden text-gray-400 hover:text-white p-2"
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
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} aria-hidden />
            <div className="absolute right-0 top-0 h-full w-full bg-gradient-to-b from-[#0f0f0f] to-[#1a1a1a] border-l border-green-500/30 shadow-2xl">
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between p-4 border-b border-green-500/20 flex-shrink-0">
                  <div className="flex items-center space-x-2">
                    <div className="w-9 h-9 bg-gradient-to-br from-green-400 via-emerald-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg">
                      <span className="text-xl font-black text-white">+</span>
                    </div>
                    <span className="text-xl font-black bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">Breez</span>
                  </div>
                  <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all active:scale-95" aria-label="Close menu">
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
                      <Link href="/admin" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-4 rounded-xl bg-green-500/15 border border-green-500/30 text-green-200 font-semibold text-lg hover:bg-green-500/25 transition">
                        {t('admin')}
                      </Link>
                    )}
                    {MENU_CONFIG.map((item) => {
                      const isExpanded = expandedKeys[item.key] || false;
                      const items = t.raw(item.itemsKey) as string[];
                      return (
                        <div key={item.key} className="border-b border-green-500/10 last:border-0 pb-2">
                          <div className="flex items-center">
                            <Link
                              href={item.href}
                              onClick={() => setMobileMenuOpen(false)}
                              className="flex-1 px-4 py-4 text-white hover:text-green-400 font-bold text-lg rounded-lg hover:bg-green-500/10 transition-all duration-200 active:bg-green-500/20 min-h-[56px] flex items-center"
                            >
                              {t(item.nameKey)}
                            </Link>
                            <button
                              onClick={() => setExpandedKeys((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                              className="p-3 ml-2 text-gray-400 hover:text-green-400 hover:bg-green-500/10 transition-all rounded-lg active:scale-95 min-w-[48px] min-h-[48px] flex items-center justify-center"
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
                                <Link key={i} href={item.href} onClick={() => setMobileMenuOpen(false)} className="flex px-4 py-3 text-gray-300 hover:text-green-400 hover:bg-green-500/5 rounded-lg transition-all duration-200 text-base active:bg-green-500/10 min-h-[48px] items-center">
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
                <div className="p-4 border-t border-green-500/20 flex-shrink-0">
                  {user ? (
                    <div className="space-y-2">
                      <div className="px-4 py-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-lg text-center">
                        <span className="text-green-400 text-sm font-medium">{user.name}</span>
                      </div>
                      <button
                        onClick={() => { onLogout?.(); setMobileMenuOpen(false); }}
                        className="w-full px-4 py-3 bg-gradient-to-r from-red-500/20 to-pink-500/20 hover:from-red-500/30 hover:to-pink-500/30 text-red-400 hover:text-red-300 font-semibold text-sm transition-all duration-200 border border-red-500/30 hover:border-red-500/50 rounded-lg active:scale-95 min-h-[48px]"
                      >
                        {t('logout')}
                      </button>
                    </div>
                  ) : (
                    <Link href="/" onClick={() => setMobileMenuOpen(false)} className="flex w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-semibold text-sm transition-all duration-200 rounded-lg shadow-lg shadow-green-500/30 text-center active:scale-95 min-h-[48px] items-center justify-center">
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
