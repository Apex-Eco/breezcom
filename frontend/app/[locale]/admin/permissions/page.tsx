'use client';

import { useEffect, useState } from 'react';
import { adminAPI, authAPI, Sensor, AdminUser, User } from '@/lib/api';
import toast from 'react-hot-toast';
import Cookies from 'js-cookie';
import { Link } from '@/i18n/navigation';
import { useRouter } from 'next/navigation';

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

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center page-shell text-red-400">Загрузка...</div>;
  }

  if (!isAuthenticated) {
    router.push('/admin');
    return null;
  }

  return (
    <div className="min-h-screen page-shell relative overflow-hidden">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#1a1a2e] to-[#0a0a0a]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,0,0,0.05),transparent_70%)]"></div>
      </div>

      <nav className="glass-strong border-b border-red-500/20 sticky top-0 z-50 shadow-2xl">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-6">
              <Link href="/admin" className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center shadow-lg">
                  <span className="text-xl font-black text-primary">⚙️</span>
                </div>
                <span className="text-2xl font-black bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">Админ Панель</span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-red-400 text-sm">{user?.name}</span>
              <button
                onClick={() => { Cookies.remove('token'); router.push('/'); }}
                className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm"
              >
                Выйти
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="relative z-10 pt-8 pb-8">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-black mb-6 wise-gradient-text">
            Управление правами доступа
          </h1>

          <div className="glass-strong rounded-2xl border border-red-500/30 p-6 mb-6">
            <h2 className="text-2xl font-bold text-primary mb-4">Выдать доступ к датчику</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-secondary mb-2">Выберите датчик</label>
                <select
                  value={grantSensorId}
                  onChange={(e) => setGrantSensorId(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-700/50 rounded-xl bg-surface text-primary"
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
                <label className="block text-sm font-bold text-secondary mb-2">Email пользователя</label>
                <input
                  type="email"
                  value={grantEmail}
                  onChange={(e) => setGrantEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-4 py-2 border-2 border-gray-700/50 rounded-xl bg-surface text-primary"
                />
              </div>
              <button
                onClick={handleGrantAccess}
                className="px-6 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-primary rounded-xl font-bold hover:from-red-400 hover:to-orange-400 transition-all"
              >
                Выдать доступ
              </button>
            </div>
          </div>

          <div className="glass-strong rounded-2xl border border-red-500/30 overflow-hidden">
            <div className="p-6 border-b border-red-500/20">
              <h2 className="text-2xl font-bold text-primary">Права пользователей</h2>
            </div>
            <div className="p-6">
              {users.filter(u => (u.sensor_permissions?.length || 0) > 0).length === 0 ? (
                <div className="text-center py-12 text-muted">
                  <p>Нет пользователей с правами доступа</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {users
                    .filter(u => (u.sensor_permissions?.length || 0) > 0)
                    .map((u) => (
                      <div key={u.id} className="p-4 bg-surface rounded-xl border border-gray-700/50">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h3 className="text-primary font-bold">{u.name}</h3>
                            <p className="text-muted text-sm">{u.email}</p>
                          </div>
                          <span className="text-red-400 font-bold">
                            {u.sensor_permissions?.length || 0} датчиков
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


