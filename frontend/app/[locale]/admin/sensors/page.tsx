'use client';

import { useEffect, useState } from 'react';
import { adminAPI, authAPI, Sensor, User } from '@/lib/api';
import toast from 'react-hot-toast';
import Cookies from 'js-cookie';
import { useRouter } from '@/i18n/navigation';
import { AdminEmptyState, AdminShell } from '@/components/admin/AdminShell';
import type { FormEvent } from 'react';

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

const emptySensorForm: SensorFormState = {
  name: '',
  description: '',
  price: '0',
  city: '',
  country: '',
  lat: '',
  lng: '',
  pm25: '',
  pm10: '',
};

export default function AdminSensorsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [sensorForm, setSensorForm] = useState<SensorFormState>(emptySensorForm);
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

  const handleCreateSensor = async (e: FormEvent) => {
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
        price,
        city: sensorForm.city,
        country: sensorForm.country,
        location: {
          type: 'Point',
          coordinates: [lng, lat],
        },
        parameters: {
          pm25,
          pm10,
        },
      });

      toast.success('Датчик создан успешно');
      setSensorForm(emptySensorForm);
      setShowForm(false);
      loadSensors();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка создания датчика');
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
      title="Sensors"
      description="Создание и управление платными датчиками Breez."
      onLogout={handleLogout}
      actions={
        <button onClick={() => setShowForm(!showForm)} className="wise-btn h-11 px-5 text-sm">
          {showForm ? 'Отмена' : 'Создать датчик'}
        </button>
      }
    >
      {showForm ? (
        <section className="breez-card mb-6 p-6">
          <h2 className="mb-5 text-2xl font-black text-primary">Создать новый датчик</h2>
          <form onSubmit={handleCreateSensor} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {[
                { key: 'name', label: 'Название *', type: 'text', required: true },
                { key: 'price', label: 'Цена (₸)', type: 'number' },
                { key: 'city', label: 'Город', type: 'text' },
                { key: 'country', label: 'Страна', type: 'text' },
                { key: 'lat', label: 'Широта (lat)', type: 'number', step: 'any' },
                { key: 'lng', label: 'Долгота (lng)', type: 'number', step: 'any' },
                { key: 'pm25', label: 'PM2.5', type: 'number', step: 'any' },
                { key: 'pm10', label: 'PM10', type: 'number', step: 'any' },
              ].map((field) => (
                <div key={field.key}>
                  <label className="mb-2 block text-sm font-bold text-secondary">{field.label}</label>
                  <input
                    type={field.type}
                    step={field.step}
                    required={field.required}
                    value={sensorForm[field.key as keyof SensorFormState]}
                    onChange={(e) => setSensorForm({ ...sensorForm, [field.key]: e.target.value })}
                    className="wise-input w-full px-4 py-3"
                  />
                </div>
              ))}
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-secondary">Описание</label>
              <textarea
                value={sensorForm.description}
                onChange={(e) => setSensorForm({ ...sensorForm, description: e.target.value })}
                className="wise-input w-full px-4 py-3"
                rows={3}
              />
            </div>
            <button type="submit" className="wise-btn h-11 px-6 text-sm">
              Создать датчик
            </button>
          </form>
        </section>
      ) : null}

      <section className="breez-card overflow-hidden">
        <div className="border-b border-theme p-6">
          <h2 className="text-2xl font-black text-primary">Список датчиков ({sensors.length})</h2>
        </div>
        <div className="p-6">
          {sensors.length === 0 ? (
            <AdminEmptyState
              icon="+"
              title="Нет созданных датчиков"
              description="Создайте первый датчик, чтобы он появился в магазине, карте и панели управления."
              action={
                <button onClick={() => setShowForm(true)} className="wise-btn h-11 px-5 text-sm">
                  Создать датчик
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sensors.map((sensor) => (
                <div key={sensor.id} className="breez-subcard p-4 transition hover:border-[var(--border-strong)]">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <h3 className="min-w-0 break-words text-lg font-black text-primary">{sensor.name}</h3>
                    <span className="shrink-0 rounded-full bg-[var(--surface-muted)] px-3 py-1 text-sm font-black text-green-300">
                      {sensor.price}₸
                    </span>
                  </div>
                  <p className="mb-4 text-sm leading-6 text-secondary">{sensor.description || 'Нет описания'}</p>
                  <div className="space-y-2 text-sm text-secondary">
                    <div><span className="font-bold text-primary">Город:</span> {sensor.city || 'N/A'}</div>
                    <div><span className="font-bold text-primary">Координаты:</span> {sensor.location?.coordinates?.[1]?.toFixed(4)}, {sensor.location?.coordinates?.[0]?.toFixed(4)}</div>
                    <div><span className="font-bold text-primary">PM2.5:</span> {sensor.parameters?.pm25 || 0}</div>
                    <div><span className="font-bold text-primary">PM10:</span> {sensor.parameters?.pm10 || 0}</div>
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
