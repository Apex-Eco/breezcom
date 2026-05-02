'use client';

import { useEffect, useState } from 'react';
import { adminAPI, authAPI, Sensor, AdminUser, User } from '@/lib/api';
import toast from 'react-hot-toast';
import Cookies from 'js-cookie';
import { useRouter } from '@/i18n/navigation';
import { AdminEmptyState, AdminShell } from '@/components/admin/AdminShell';

export default function AdminPermissionsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [grantEmail, setGrantEmail] = useState('');
  const [grantSensorId, setGrantSensorId] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const me = await authAPI.getMe();
        setUser(me);
        if (me.role === 'admin') {
          setIsAuthenticated(true);
          loadData();
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

  const loadData = async () => {
    try {
      const [s, u] = await Promise.all([
        adminAPI.listSensors(),
        adminAPI.listUsers(),
      ]);
      setSensors(s);
      setUsers(u);
    } catch (err) {
      console.error(err);
      toast.error('Не удалось загрузить данные');
    }
  };

  const handleGrantAccess = async () => {
    if (!grantEmail.trim() || !grantSensorId) {
      toast.error('Выберите датчик и введите email');
      return;
    }
    try {
      await adminAPI.grantAccess(grantSensorId, grantEmail);
      toast.success(`Доступ к датчику выдан пользователю ${grantEmail}`);
      setGrantEmail('');
      setGrantSensorId('');
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка');
    }
  };

  const handleLogout = () => {
    authAPI.logout();
    router.push('/');
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center page-shell text-xl font-bold text-green-400">Загрузка...</div>;
  }

  if (!isAuthenticated) {
    router.push('/admin');
    return null;
  }

  const usersWithPermissions = users.filter((u) => (u.sensor_permissions?.length || 0) > 0);

  return (
    <AdminShell
      user={user}
      title="Permissions"
      description="Выдача пользователям доступа к платным датчикам."
      onLogout={handleLogout}
    >
      <section className="breez-card mb-6 p-6">
        <h2 className="mb-4 text-2xl font-black text-primary">Выдать доступ к датчику</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <div>
            <label className="mb-2 block text-sm font-bold text-secondary">Выберите датчик</label>
            <select
              value={grantSensorId}
              onChange={(e) => setGrantSensorId(e.target.value)}
              className="wise-input w-full px-4 py-3"
            >
              <option value="">-- Выберите датчик --</option>
              {sensors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.price}₸) - {s.city}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-secondary">Email пользователя</label>
            <input
              type="email"
              value={grantEmail}
              onChange={(e) => setGrantEmail(e.target.value)}
              placeholder="user@example.com"
              className="wise-input w-full px-4 py-3"
            />
          </div>
          <button onClick={handleGrantAccess} className="wise-btn h-12 px-6 text-sm">
            Выдать доступ
          </button>
        </div>
      </section>

      <section className="breez-card overflow-hidden">
        <div className="border-b border-theme p-6">
          <h2 className="text-2xl font-black text-primary">Права пользователей</h2>
        </div>
        <div className="p-6">
          {usersWithPermissions.length === 0 ? (
            <AdminEmptyState
              icon="P"
              title="Нет пользователей с правами доступа"
              description="Выданные вручную права на датчики будут отображаться в этом разделе."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {usersWithPermissions.map((u) => (
                <div key={u.id} className="breez-subcard p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="break-words font-black text-primary">{u.name}</h3>
                      <p className="mt-1 break-words text-sm text-muted">{u.email}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[var(--surface-muted)] px-3 py-1 text-sm font-black text-green-300">
                      {u.sensor_permissions?.length || 0} датчиков
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </AdminShell>
  );
}
