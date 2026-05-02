'use client';

import { useEffect, useState } from 'react';
import { adminAPI, authAPI, User, adminAuthAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import Cookies from 'js-cookie';
import { Link, useRouter } from '@/i18n/navigation';
import { AdminShell } from '@/components/admin/AdminShell';

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminSecret, setAdminSecret] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [stats, setStats] = useState({
    totalSensors: 0,
    totalUsers: 0,
    totalPurchases: 0,
    activeSensors: 0,
  });

  useEffect(() => {
    const init = async () => {
      try {
        const me = await authAPI.getMe();
        setUser(me);
        if (me.role === 'admin') {
          setIsAuthenticated(true);
          loadStats();
        } else {
          setIsAuthenticated(false);
        }
      } catch (err) {
        Cookies.remove('token');
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const loadStats = async () => {
    try {
      const [sensors, users] = await Promise.all([
        adminAPI.listSensors(),
        adminAPI.listUsers(),
      ]);
      setStats({
        totalSensors: sensors.length,
        totalUsers: users.length,
        totalPurchases: users.reduce((sum, u) => sum + (u.sensor_permissions?.length || 0), 0),
        activeSensors: sensors.filter((s) => s.price > 0).length,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdminLogin = async () => {
    if (!adminSecret.trim()) {
      toast.error('Введите админ секрет');
      return;
    }
    try {
      await adminAuthAPI.login(adminSecret);
      const me = await authAPI.getMe();
      setUser(me);
      if (me.role === 'admin') {
        setIsAuthenticated(true);
        toast.success('Вход выполнен успешно');
        loadStats();
      } else {
        toast.error('Неверный секрет');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка входа');
    }
  };

  const handleLogout = () => {
    authAPI.logout();
    setUser(null);
    setIsAuthenticated(false);
    router.push('/');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center page-shell">
        <div className="text-xl font-bold text-green-400">Загрузка...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center page-shell px-4">
        <div className="breez-card w-full max-w-md p-7 sm:p-8">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#9fe870] text-2xl font-black text-[#163300]">
              B
            </div>
            <h1 className="text-3xl font-black text-primary">Breez Admin</h1>
            <p className="mt-2 text-sm leading-6 text-secondary">Введите админ секрет для доступа к панели.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-bold text-secondary">Админ Секрет</label>
              <input
                type="password"
                value={adminSecret}
                onChange={(e) => setAdminSecret(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                className="wise-input w-full px-4 py-3"
                placeholder="admin-secret"
              />
            </div>

            <button onClick={handleAdminLogin} className="wise-btn h-12 w-full text-base">
              Войти как админ
            </button>
          </div>
        </div>
      </main>
    );
  }

  const statCards = [
    { label: 'Всего датчиков', value: stats.totalSensors, caption: 'Созданных в системе', icon: 'S' },
    { label: 'Пользователей', value: stats.totalUsers, caption: 'Зарегистрировано', icon: 'U' },
    { label: 'Покупок', value: stats.totalPurchases, caption: 'Всего совершено', icon: '₸' },
    { label: 'Активных', value: stats.activeSensors, caption: 'Платных датчиков', icon: '✓' },
  ];

  return (
    <AdminShell
      user={user}
      title="Dashboard"
      description="Обзор системы, датчиков, пользователей и доступов."
      onLogout={handleLogout}
    >
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="breez-card p-5">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-muted)] text-xl font-black text-green-300">
                {card.icon}
              </div>
              <span className="text-4xl font-black text-primary">{card.value}</span>
            </div>
            <h3 className="text-lg font-black text-primary">{card.label}</h3>
            <p className="mt-1 text-sm text-muted">{card.caption}</p>
          </div>
        ))}
      </div>

      <section className="breez-card p-6">
        <h2 className="mb-4 text-2xl font-black text-primary">Быстрые действия</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { href: '/admin/sensors', title: 'Создать датчик', text: 'Добавить новый платный датчик', icon: '+' },
            { href: '/admin/users', title: 'Управление пользователями', text: 'Просмотр и редактирование', icon: 'U' },
            { href: '/admin/permissions', title: 'Права доступа', text: 'Выдача прав на датчики', icon: 'P' },
          ].map((action) => (
            <Link key={action.href} href={action.href} className="breez-subcard group flex items-center gap-4 p-4 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#9fe870] font-black text-[#163300]">
                {action.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-base font-black text-primary">{action.title}</span>
                <span className="mt-1 block text-sm text-muted">{action.text}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
