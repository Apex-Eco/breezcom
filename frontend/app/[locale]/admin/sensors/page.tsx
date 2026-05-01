'use client';

import { useEffect, useState } from 'react';
import { adminAPI, authAPI, Sensor, User, adminAuthAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import Cookies from 'js-cookie';
import { Link } from '@/i18n/navigation';
import { useRouter } from 'next/navigation';

interface SensorFormState {
  name: string;
  description: string;
  price: string;
  city: string;
  country: string;
  lat: string;
  lng: string;
  pm25: string;
  pm10: string;
}

export default function AdminSensorsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [sensorForm, setSensorForm] = useState<SensorFormState>({
    name: '',
    description: '',
    price: '0',
    city: '',
    country: '',
    lat: '',
    lng: '',
    pm25: '',
    pm10: '',
  });
  const [showForm, setShowForm] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const me = await authAPI.getMe();
        setUser(me);
        if (me.role === 'admin') {
          setIsAuthenticated(true);
          loadSensors();
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

  const loadSensors = async () => {
    try {
      const data = await adminAPI.listSensors();
      setSensors(data);
    } catch (err) {
      console.error(err);
      toast.error('Не удалось загрузить датчики');
    }
  };

  const handleCreateSensor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sensorForm.name.trim()) {
      toast.error('Название обязательно');
      return;
    }
    try {
      const price = parseFloat(sensorForm.price || '0');
      const lat = parseFloat(sensorForm.lat || '0');
      const lng = parseFloat(sensorForm.lng || '0');
      const pm25 = parseFloat(sensorForm.pm25 || '0');
      const pm10 = parseFloat(sensorForm.pm10 || '0');

      await adminAPI.createSensor({
        name: sensorForm.name,
        description: sensorForm.description,
        price: price,
        city: sensorForm.city,
        country: sensorForm.country,
        location: {
          type: 'Point',
          coordinates: [lng, lat],
        },
        parameters: {
          pm25: pm25,
          pm10: pm10,
        },
      });

      toast.success('Датчик создан успешно');
      setSensorForm({
        name: '',
        description: '',
        price: '0',
        city: '',
        country: '',
        lat: '',
        lng: '',
        pm25: '',
        pm10: '',
      });
      setShowForm(false);
      loadSensors();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка создания датчика');
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

      {/* Admin Navbar */}
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
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-black mb-2 wise-gradient-text">
                Управление датчиками
              </h1>
              <p className="text-secondary">Создание и управление платными датчиками</p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-6 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-primary rounded-xl font-bold hover:from-red-400 hover:to-orange-400 transition-all"
            >
              {showForm ? '✕ Отмена' : '+ Создать датчик'}
            </button>
          </div>

          {showForm && (
            <div className="glass-strong rounded-2xl border border-red-500/30 p-6 mb-6">
              <h2 className="text-2xl font-bold text-primary mb-4">Создать новый датчик</h2>
              <form onSubmit={handleCreateSensor} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-secondary mb-2">Название *</label>
                    <input
                      type="text"
                      value={sensorForm.name}
                      onChange={(e) => setSensorForm({ ...sensorForm, name: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-700/50 rounded-xl bg-surface text-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-secondary mb-2">Цена (₸)</label>
                    <input
                      type="number"
                      value={sensorForm.price}
                      onChange={(e) => setSensorForm({ ...sensorForm, price: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-700/50 rounded-xl bg-surface text-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-secondary mb-2">Город</label>
                    <input
                      type="text"
                      value={sensorForm.city}
                      onChange={(e) => setSensorForm({ ...sensorForm, city: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-700/50 rounded-xl bg-surface text-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-secondary mb-2">Страна</label>
                    <input
                      type="text"
                      value={sensorForm.country}
                      onChange={(e) => setSensorForm({ ...sensorForm, country: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-700/50 rounded-xl bg-surface text-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-secondary mb-2">Широта (lat)</label>
                    <input
                      type="number"
                      step="any"
                      value={sensorForm.lat}
                      onChange={(e) => setSensorForm({ ...sensorForm, lat: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-700/50 rounded-xl bg-surface text-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-secondary mb-2">Долгота (lng)</label>
                    <input
                      type="number"
                      step="any"
                      value={sensorForm.lng}
                      onChange={(e) => setSensorForm({ ...sensorForm, lng: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-700/50 rounded-xl bg-surface text-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-secondary mb-2">PM2.5</label>
                    <input
                      type="number"
                      step="any"
                      value={sensorForm.pm25}
                      onChange={(e) => setSensorForm({ ...sensorForm, pm25: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-700/50 rounded-xl bg-surface text-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-secondary mb-2">PM10</label>
                    <input
                      type="number"
                      step="any"
                      value={sensorForm.pm10}
                      onChange={(e) => setSensorForm({ ...sensorForm, pm10: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-700/50 rounded-xl bg-surface text-primary"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-secondary mb-2">Описание</label>
                  <textarea
                    value={sensorForm.description}
                    onChange={(e) => setSensorForm({ ...sensorForm, description: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-700/50 rounded-xl bg-surface text-primary"
                    rows={3}
                  />
                </div>
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-primary rounded-xl font-bold hover:from-red-400 hover:to-orange-400 transition-all"
                >
                  Создать датчик
                </button>
              </form>
            </div>
          )}

          <div className="glass-strong rounded-2xl border border-red-500/30 overflow-hidden">
            <div className="p-6 border-b border-red-500/20">
              <h2 className="text-2xl font-bold text-primary">Список датчиков ({sensors.length})</h2>
            </div>
            <div className="p-6">
              {sensors.length === 0 ? (
                <div className="text-center py-12 text-muted">
                  <p className="text-lg">Нет созданных датчиков</p>
                  <p className="text-sm mt-2">Создайте первый датчик, чтобы начать</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sensors.map((sensor) => (
                    <div
                      key={sensor.id}
                      className="p-4 bg-surface rounded-xl border border-gray-700/50 hover:border-red-500/50 transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-primary font-bold text-lg">{sensor.name}</h3>
                        <span className="text-red-400 font-bold">{sensor.price}₸</span>
                      </div>
                      <p className="text-muted text-sm mb-3">{sensor.description || 'Нет описания'}</p>
                      <div className="space-y-1 text-sm">
                        <div className="text-muted">
                          <span className="text-muted">Город:</span> {sensor.city || 'N/A'}
                        </div>
                        <div className="text-muted">
                          <span className="text-muted">Координаты:</span> {sensor.location?.coordinates?.[1]?.toFixed(4)}, {sensor.location?.coordinates?.[0]?.toFixed(4)}
                        </div>
                        <div className="text-muted">
                          <span className="text-muted">PM2.5:</span> {sensor.parameters?.pm25 || 0}
                        </div>
                        <div className="text-muted">
                          <span className="text-muted">PM10:</span> {sensor.parameters?.pm10 || 0}
                        </div>
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


