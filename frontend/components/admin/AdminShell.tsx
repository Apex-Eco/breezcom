'use client';

import { Link, usePathname } from '@/i18n/navigation';
import type { User } from '@/lib/api';
import type { ReactNode } from 'react';

interface AdminShellProps {
  user: User | null;
  title: string;
  description?: string;
  actions?: ReactNode;
  onLogout: () => void;
  children: ReactNode;
}

interface AdminEmptyStateProps {
  icon: string;
  title: string;
  description: string;
  action?: ReactNode;
}

const adminTabs = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'Sensors', href: '/admin/sensors' },
  { label: 'Users', href: '/admin/users' },
  { label: 'Permissions', href: '/admin/permissions' },
];

export function AdminShell({ user, title, description, actions, onLogout, children }: AdminShellProps) {
  const pathname = usePathname();

  return (
    <main className="min-h-screen page-shell">
      <nav className="wise-nav sticky top-0 z-50 border-b">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="flex min-w-0 items-center justify-between gap-4">
            <Link href="/admin" className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#9fe870] text-lg font-black text-[#163300]">
                B
              </span>
              <span className="truncate text-lg font-black text-primary sm:text-xl">Breez Admin</span>
            </Link>
            <div className="flex shrink-0 items-center gap-2 lg:hidden">
              <span className="max-w-[9rem] truncate rounded-full border border-theme bg-surface px-3 py-1.5 text-xs font-bold text-secondary">
                {user?.name || 'Admin'}
              </span>
              <button onClick={onLogout} className="wise-btn-secondary h-9 px-3 text-xs">
                Logout
              </button>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto lg:justify-center">
            {adminTabs.map((tab) => {
              const active = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-bold transition ${
                    active
                      ? 'bg-[#9fe870] text-[#163300]'
                      : 'border border-theme bg-surface text-secondary hover:border-[var(--border-strong)] hover:text-primary'
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>

          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            <span className="max-w-[14rem] truncate rounded-full border border-theme bg-surface px-4 py-2 text-sm font-bold text-secondary">
              {user?.name || 'Admin user'}
            </span>
            <button onClick={onLogout} className="wise-btn-secondary h-10 px-4 text-sm">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        <header className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-muted">Admin Panel</p>
            <h1 className="max-w-4xl text-[clamp(2rem,5vw,3.5rem)] font-black leading-[1.02] text-primary">
              {title}
            </h1>
            {description ? (
              <p className="mt-3 max-w-2xl text-base leading-7 text-secondary">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-3">{actions}</div> : null}
        </header>

        {children}
      </div>
    </main>
  );
}

export function AdminEmptyState({ icon, title, description, action }: AdminEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-theme bg-surface p-10 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-muted)] text-2xl">
        {icon}
      </div>
      <h3 className="text-lg font-black text-primary">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-secondary">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
