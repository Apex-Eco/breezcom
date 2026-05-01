'use client';

import { useEffect, useState } from 'react';
import { adminAPI, authAPI, AdminUser, User, adminAuthAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import Cookies from 'js-cookie';
import { Link } from '@/i18n/navigation';
import { useRouter } from 'next/navigation';

export default function AdminUsersPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [makeAdminEmail, setMakeAdminEmail] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const me = await authAPI.getMe();
        setUser(me);
        if (me.role === 'admin') {
          setIsAuthenticated(true);
          loadUsers();
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

  const loadUsers = async () => {
    try {
      const data = await adminAPI.listUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
      toast.error('Не удалось загрузить пользователей');
    }
  };

  const handleMakeAdmin = async () => {
    if (!makeAdminEmail.trim()) {
      toast.error('Введите email');
      return;
    }
    try {
      await adminAPI.makeAdmin(makeAdminEmail);
      toast.success(`Пользователь ${makeAdminEmail} теперь админ`);
      setMakeAdminEmail('');
      loadUsers();
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
            Управление пользователями
          </h1>

          <div className="glass-strong rounded-2xl border border-red-500/30 p-6 mb-6">
            <h2 className="text-2xl font-bold text-primary mb-4">Сделать пользователя админом</h2>
            <div className="flex gap-4">
              <input
                type="email"
                value={makeAdminEmail}
                onChange={(e) => setMakeAdminEmail(e.target.value)}
                placeholder="email@example.com"
                className="flex-1 px-4 py-2 border-2 border-gray-700/50 rounded-xl bg-surface text-primary"
              />
              <button
                onClick={handleMakeAdmin}
                className="px-6 py-2 bg-gradient-to-r from-red-500 to-orange-500 text-primary rounded-xl font-bold hover:from-red-400 hover:to-orange-400 transition-all"
              >
                Сделать админом
              </button>
            </div>
          </div>

          <div className="glass-strong rounded-2xl border border-red-500/30 overflow-hidden">
            <div className="p-6 border-b border-red-500/20">
              <h2 className="text-2xl font-bold text-primary">Список пользователей ({users.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface">
                  <tr>
                    <th className="px-6 py-4 text-left text-muted font-bold">Email</th>
                    <th className="px-6 py-4 text-left text-muted font-bold">Имя</th>
                    <th className="px-6 py-4 text-left text-muted font-bold">Роль</th>
                    <th className="px-6 py-4 text-left text-muted font-bold">Доступ к датчикам</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-gray-700/30 hover:bg-surface transition-colors">
                      <td className="px-6 py-4 text-primary">{u.email}</td>
                      <td className="px-6 py-4 text-secondary">{u.name}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-lg text-sm font-bold ${
                          u.role === 'admin' 
                            ? 'bg-red-500/20 text-red-400' 
                            : 'bg-gray-500/20 text-muted'
                        }`}>
                          {u.role === 'admin' ? 'Админ' : 'Пользователь'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-secondary">
                        {u.sensor_permissions?.length || 0} датчиков
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


