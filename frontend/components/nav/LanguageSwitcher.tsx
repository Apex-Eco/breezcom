'use client';

import { usePathname, useRouter } from '@/i18n/navigation';
import { useLocale } from 'next-intl';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { routing } from '@/i18n/routing';
import clsx from 'clsx';

export function LanguageSwitcher() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const handleLocaleChange = useCallback(
    (newLocale: 'en' | 'ru' | 'kk') => {
      if (newLocale === locale) return;
      router.replace(pathname, { locale: newLocale });
    },
    [locale, pathname, router]
  );

  return (
    <div
      className="flex items-center rounded-full border border-theme overflow-hidden bg-surface"
      role="group"
      aria-label={t('changeLanguage')}
    >
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => handleLocaleChange(loc as 'en' | 'ru' | 'kk')}
          aria-pressed={locale === loc}
          aria-label={`${t('changeLanguage')}: ${t(`language.${loc}`)}`}
          className={clsx(
            'px-3 py-1.5 text-xs font-bold transition-all min-w-[40px]',
            'focus:outline-none focus:ring-2 focus:ring-green-500/50',
            locale === loc
              ? 'bg-[#9fe870] text-[#163300]'
              : 'text-muted hover:bg-green-500/10 hover:text-primary'
          )}
        >
          {t(`language.${loc}`)}
        </button>
      ))}
    </div>
  );
}
