'use client';

import { useEffect, useState } from 'react';
import { adminAPI, authAPI, AdminUser, User } from '@/lib/api';
import toast from 'react-hot-toast';
import Cookies from 'js-cookie';
import { useRouter } from '@/i18n/navigation';
import { AdminEmptyState, AdminShell } from '@/components/admin/AdminShell';

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

  return (
    <AdminShell
      user={user}
      title="Users"
      description="Просмотр пользователей и выдача административной роли."
      onLogout={handleLogout}
    >
      <section className="breez-card mb-6 p-6">
        <h2 className="mb-4 text-2xl font-black text-primary">Сделать пользователя админом</h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="email"
            value={makeAdminEmail}
            onChange={(e) => setMakeAdminEmail(e.target.value)}
            placeholder="email@example.com"
            className="wise-input min-w-0 flex-1 px-4 py-3"
          />
          <button onClick={handleMakeAdmin} className="wise-btn h-12 px-5 text-sm">
            Сделать админом
          </button>
        </div>
      </section>

      <section className="breez-card overflow-hidden">
        <div className="border-b border-theme p-6">
          <h2 className="text-2xl font-black text-primary">Список пользователей ({users.length})</h2>
        </div>
        {users.length === 0 ? (
          <div className="p-6">
            <AdminEmptyState
              icon="U"
              title="Пользователи не найдены"
              description="Когда пользователи зарегистрируются, они появятся здесь вместе с ролями и доступами."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="breez-table">
              <thead className="bg-[var(--surface-muted)]">
                <tr>
                  <th>Email</th>
                  <th>Имя</th>
                  <th>Роль</th>
                  <th>Доступ к датчикам</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="max-w-[18rem] break-words text-primary">{u.email}</td>
                    <td className="max-w-[16rem] break-words text-secondary">{u.name}</td>
                    <td>
                      <span className={`rounded-full px-3 py-1 text-sm font-bold ${
                        u.role === 'admin'
                          ? 'bg-green-500/15 text-green-300'
                          : 'bg-[var(--surface-muted)] text-secondary'
                      }`}>
                        {u.role === 'admin' ? 'Админ' : 'Пользователь'}
                      </span>
                    </td>
                    <td className="text-secondary">{u.sensor_permissions?.length || 0} датчиков</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
