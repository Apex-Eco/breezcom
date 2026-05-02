'use client';

import { useEffect, useState } from 'react';
import { sensorAPI, authAPI, Sensor, User } from '@/lib/api';
import toast from 'react-hot-toast';
import Cookies from 'js-cookie';
import Navigation from '@/components/Navigation';
import { Link } from '@/i18n/navigation';

export default function SensorsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [allSensors, setAllSensors] = useState<(Sensor & { is_purchased: boolean })[]>([]);
  const [mySensors, setMySensors] = useState<Sensor[]>([]);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const me = await authAPI.getMe();
        setUser(me);
        await Promise.all([loadAllSensors(), loadMySensors()]);
      } catch (err) {
        Cookies.remove('token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const loadAllSensors = async () => {
    try {
      const data = await sensorAPI.allSensors();
      console.log('📊 Loaded all sensors:', data.length);
      console.log('📊 Sensors data:', data);
      setAllSensors(data);
    } catch (err: any) {
      console.error('❌ Error loading all sensors:', err);
      console.error('❌ Error details:', err.response?.data || err.message);
      // Устанавливаем пустой массив при ошибке, чтобы не ломать UI
      setAllSensors([]);
    }
  };

  const loadMySensors = async () => {
    try {
      const data = await sensorAPI.mySensors();
      setMySensors(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePurchase = async (sensorId: string) => {
    setPurchasing(sensorId);
    try {
      await sensorAPI.purchase(sensorId);
      toast.success('Датчик успешно куплен! Теперь он доступен на карте с дополнительными параметрами.');
      // Небольшая задержка, чтобы база данных успела обновиться
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Перезагружаем данные несколько раз для надежности
      console.log('🔄 Reloading sensors after purchase...');
      await Promise.all([loadAllSensors(), loadMySensors()]);
      await new Promise(resolve => setTimeout(resolve, 500));
      await Promise.all([loadAllSensors(), loadMySensors()]);
      console.log('✅ Sensors reloaded');
    } catch (err: any) {
      console.error('❌ Purchase error:', err);
      toast.error(err.response?.data?.detail || 'Ошибка покупки');
    } finally {
      setPurchasing(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center page-shell">
        <div className="text-green-400 text-xl">Загрузка...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center page-shell px-4">
        <div className="breez-card max-w-md p-8 text-center">
          <div className="text-xl font-black text-primary mb-3">Необходима авторизация</div>
          <p className="mb-5 text-sm leading-6 text-secondary">Войдите в систему, чтобы покупать датчики и управлять доступом к данным.</p>
          <Link href="/" className="wise-btn h-11 px-5 text-sm">
            Войти в систему
          </Link>
        </div>
      </div>
    );
  }

  const purchasedSensors = allSensors.filter(s => s.is_purchased);
  const availableSensors = allSensors.filter(s => !s.is_purchased);

  return (
    <main className="min-h-screen page-shell">
      <Navigation user={user} onLogout={() => { Cookies.remove('token'); setUser(null); }} />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
          <div className="mb-8 max-w-3xl">
            <h1 className="text-[clamp(2.25rem,6vw,4.5rem)] font-black leading-[1.02] mb-4 wise-gradient-text">
              Магазин датчиков
            </h1>
            <p className="text-secondary text-base leading-7 sm:text-lg">
              Покупайте доступ к платным датчикам для просмотра данных на карте с дополнительными параметрами
            </p>
          </div>

          {purchasedSensors.length > 0 && (
            <div className="breez-card p-6 mb-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
                <h2 className="text-2xl font-black text-primary">
                  Купленные датчики ({purchasedSensors.length})
                </h2>
                <Link
                  href="/3d-map"
                  className="wise-btn-secondary h-10 px-4 text-sm"
                >
                  Посмотреть на карте
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {purchasedSensors.map((sensor) => (
                  <div
                    key={sensor.id}
                    className="breez-subcard p-4 relative"
                  >
                    <div className="absolute top-3 right-3">
                      <span className="px-2 py-1 bg-green-500/15 text-green-300 text-xs font-bold rounded-full border border-green-500/25">
                        Куплено
                      </span>
                    </div>
                    <h3 className="text-primary font-bold text-lg mb-2 pr-20">{sensor.name}</h3>
                    <p className="text-muted text-sm mb-3">{sensor.description || 'Нет описания'}</p>
                    <div className="space-y-1 text-sm text-muted mb-3">
                      <div><span className="text-muted">Город:</span> {sensor.city || 'N/A'}</div>
                      <div><span className="text-muted">Страна:</span> {sensor.country || 'N/A'}</div>
                      <div><span className="text-muted">PM2.5:</span> {sensor.parameters?.pm25 || 0} µg/m³</div>
                      <div><span className="text-muted">PM10:</span> {sensor.parameters?.pm10 || 0} µg/m³</div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-green-500/20">
                      <p className="text-green-300 text-xs font-semibold mb-1">Доступны дополнительные параметры:</p>
                      <div className="flex flex-wrap gap-2">
                        {['CO2', 'VOC', 'CO', 'O3', 'NO2'].map((label) => (
                          <span key={label} className="px-2 py-1 bg-[var(--surface-muted)] text-secondary text-xs rounded-full">{label}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="breez-card p-6">
            <h2 className="text-2xl font-black text-primary mb-4">
              Доступные для покупки ({availableSensors.length})
            </h2>
            {availableSensors.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-theme bg-[var(--surface-muted)] px-6 py-12 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface text-lg font-black text-green-300">S</div>
                <p className="text-lg font-black text-primary">Нет доступных датчиков</p>
                <p className="text-sm mt-2 text-secondary">Все датчики уже куплены или еще не созданы</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableSensors.map((sensor) => (
                  <div
                    key={sensor.id}
                    className="breez-subcard p-4 hover:border-[var(--border-strong)] transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-primary font-bold text-lg">{sensor.name}</h3>
                      <span className="text-green-300 font-bold text-xl">{sensor.price}₸</span>
                    </div>
                    <p className="text-muted text-sm mb-4">{sensor.description || 'Нет описания'}</p>
                    <div className="space-y-1 text-sm text-muted mb-4">
                      <div><span className="text-muted">Город:</span> {sensor.city || 'N/A'}</div>
                      <div><span className="text-muted">Страна:</span> {sensor.country || 'N/A'}</div>
                      <div><span className="text-muted">PM2.5:</span> {sensor.parameters?.pm25 || 0} µg/m³</div>
                      <div><span className="text-muted">PM10:</span> {sensor.parameters?.pm10 || 0} µg/m³</div>
                    </div>
                    <button
                      onClick={() => handlePurchase(sensor.id)}
                      disabled={purchasing === sensor.id}
                      className="wise-btn w-full py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {purchasing === sensor.id ? 'Покупка...' : 'Купить датчик'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
      </div>
    </main>
  );
}
