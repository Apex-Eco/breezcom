'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useRef } from 'react';
import { authAPI, airQualityAPI, AirQualityData } from '@/lib/api';
import { useSensorsOnMap, type MapSensor } from '@/hooks/useSensorsOnMap';
import AirQualityCard from '@/components/AirQualityCard';
import { SensorDetailPanel } from '@/components/map/SensorDetailPanel';
import AuthModal from '@/components/AuthModal';
import Navigation from '@/components/Navigation';
import Cookies from 'js-cookie';
import { useTranslations } from 'next-intl';

const MapCard = dynamic(
  () =>
    import('@/components/map/MapCard')
      .then((m) => ({ default: m.MapCard }))
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        const isChunkError = /ChunkLoadError|Loading chunk/i.test(message);

        if (typeof window !== 'undefined' && isChunkError) {
          const retryKey = 'mapcard_chunk_retry_done';
          if (!sessionStorage.getItem(retryKey)) {
            sessionStorage.setItem(retryKey, '1');
            window.location.reload();
          }
        }

        throw error;
      }),
  { ssr: false }
);

export default function Home() {
  const t = useTranslations('home');
  const tCommon = useTranslations('common');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState<MapSensor | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Загружаем данные со всех источников, включая данные из БД
  const { sensors, loading: mapLoading, error: mapError, refetch: refetchMap } =
    useSensorsOnMap({
      userId: user?.id ?? null,
      refetchIntervalMs: 5000,
    });

  // Auto-select first sensor or update selected sensor with fresh data
  useEffect(() => {
    if (sensors.length === 0) return;
    setSelectedSensor((previous) => {
      if (!previous) return sensors[0];
      const updated = sensors.find((sensor) => sensor.id === previous.id);
      return updated ?? sensors[0];
    });
  }, [sensors]);

  // Separate fetch for the AirQualityCard sidebar (not rendered on the map)
  const [allAirQuality, setAllAirQuality] = useState<AirQualityData[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    airQualityAPI.getAllAirQuality()
      .then((data) => {
        if (!cancelled) setAllAirQuality(data || []);
      })
      .catch((error) => {
        console.error('[air-quality] getAllAirQuality failed', error);
      });
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            entry.target.classList.add('revealed', 'visible', 'in-view');
          }, index * 50);
        }
      });
    }, observerOptions);
    const revealElements = document.querySelectorAll(
      '.scroll-reveal, .slide-up, .scale-in, .rotate-in, .smooth-section'
    );
    revealElements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sensors]);

  const checkAuth = async () => {
    console.log('[auth] checkAuth start');
    const token = Cookies.get('token');
    if (token) {
      try {
        const userData = await authAPI.getMe();
        console.log('[auth] getMe success', userData);
        setUser(userData);
      } catch (error) {
        console.error('[auth] getMe failed', error);
        Cookies.remove('token');
        setShowAuth(true);
      }
    } else {
      console.log('[auth] no token found');
      setShowAuth(true);
    }
    console.log('[auth] checkAuth done');
    setLoading(false);
  };

  const getErrorMessage = (error: any, fallback: string): string => {
    const detail = error?.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0];
      return typeof first === 'object' && first?.msg ? first.msg : String(first);
    }
    return error?.message || fallback;
  };

  const handleLogin = async (email: string, password: string) => {
    try {
      await authAPI.login(email, password);
      const userData = await authAPI.getMe();
      setUser(userData);
      setShowAuth(false);
    } catch (error: any) {
      throw new Error(getErrorMessage(error, 'Login failed'));
    }
  };

  const handleRegister = async (email: string, password: string, name: string) => {
    try {
      await authAPI.register(email, password, name);
      await handleLogin(email, password);
    } catch (error: any) {
      throw new Error(getErrorMessage(error, 'Registration failed'));
    }
  };

  const handleLogout = () => {
    authAPI.logout();
    setUser(null);
    setShowAuth(true);
  };

  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-[#0f0f1a] via-[#1a1a2e] to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,255,136,0.1),transparent_70%)] animate-pulse" />
        <div className="relative text-center z-10">
          <div className="relative mb-8">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-green-500/20 border-t-green-500 mx-auto" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-400 animate-spin" style={{ animationDuration: '1.2s', animationDirection: 'reverse' }} />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-r-cyan-400 animate-spin" style={{ animationDuration: '0.8s' }} />
            <div className="absolute inset-4 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 blur-xl animate-pulse" />
          </div>
          <div className="text-green-400 font-bold text-xl mb-2 tracking-wide">{tCommon('loading')}</div>
          <div className="text-gray-400 text-sm">{tCommon('connectingSensors')}</div>
          <div className="mt-4 flex justify-center gap-1">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black">
      {showAuth && !user ? (
        <AuthModal onLogin={handleLogin} onRegister={handleRegister} onClose={() => {}} />
      ) : (
        <>
          <Navigation user={user} onLogout={handleLogout} />

          <div className="relative overflow-hidden section-transition" style={{ minHeight: '80vh' }}>
            <div className="absolute inset-0">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-transparent" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(0,255,136,0.15),transparent_60%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_60%,rgba(0,212,255,0.1),transparent_60%)]" />
            </div>
            <div ref={heroRef} className="relative container mx-auto px-4 py-16 md:py-24 border-b border-green-500/20 scroll-reveal">
              <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-cyan-500/20 border border-green-500/40 rounded-full text-sm font-medium text-green-300 mb-8 backdrop-blur-md shadow-lg shadow-green-500/10 float-animation">
                <div className="relative">
                  <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse" />
                  <div className="absolute inset-0 w-2.5 h-2.5 bg-green-400 rounded-full animate-ping opacity-75" />
                </div>
                <span className="tracking-wide">{t('realtimeBadge')}</span>
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-9xl font-black mb-6 md:mb-8 leading-tight">
                <span className="bg-gradient-to-r from-white via-green-100 via-emerald-200 to-cyan-200 bg-clip-text text-transparent block mb-2">
                  {t('airQuality')}
                </span>
                <span className="bg-gradient-to-r from-green-400 via-emerald-400 to-cyan-400 bg-clip-text text-transparent block">
                  {t('inAlmaty')}
                </span>
              </h1>
              <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-300 max-w-3xl leading-relaxed mb-8 md:mb-12">
                {t('subtitle')}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className="px-5 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl text-white font-bold shadow-2xl shadow-green-500/30 hover:scale-105 transition-transform cursor-pointer text-center text-sm sm:text-base">
                  {t('startMonitoring')}
                </div>
                <div className="px-5 sm:px-6 py-2.5 sm:py-3 border-2 border-green-500/50 rounded-xl text-green-400 font-bold hover:bg-green-500/10 transition-all cursor-pointer text-center text-sm sm:text-base">
                  {t('learnMore')}
                </div>
              </div>
            </div>
          </div>

          <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 md:py-16 section-transition">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 mb-6 sm:mb-8">
              <div className="lg:col-span-2">
                <MapCard sensors={sensors} loading={mapLoading} error={mapError} onRefetch={refetchMap} onSensorClick={setSelectedSensor} />
              </div>
              <div className="space-y-6">
                {selectedSensor ? (
                  <SensorDetailPanel sensor={selectedSensor} />
                ) : allAirQuality.length > 0 ? (
                  <div ref={cardRef} className="scroll-reveal">
                    <AirQualityCard data={allAirQuality[0]} />
                  </div>
                ) : (
                  <div className="glass-strong rounded-3xl border border-green-500/30 p-8 text-center">
                    <div className="text-4xl mb-3">📍</div>
                    <p className="text-gray-400 text-sm">Нажмите на датчик на карте для просмотра данных</p>
                  </div>
                )}
              </div>
            </div>

            {sensors.length > 0 && (
              <div className="mt-8 md:mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                <div className="glass rounded-2xl p-8 border border-green-500/20 hover-lift scale-in group relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative z-10">
                    <div className="text-5xl font-black text-green-400 mb-3">{sensors.length}</div>
                    <div className="text-gray-400 text-sm font-medium uppercase tracking-wide">{t('activeSensorsCount')}</div>
                  </div>
                </div>
                <div className="glass rounded-2xl p-8 border border-emerald-500/20 hover-lift scale-in group relative overflow-hidden" style={{ transitionDelay: '0.1s' }}>
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative z-10">
                    <div className="text-5xl font-black text-emerald-400 mb-3">
                      {sensors.length > 0 ? Math.round(sensors.reduce((sum, s) => sum + s.aqi, 0) / sensors.length) : 0}
                    </div>
                    <div className="text-gray-400 text-sm font-medium uppercase tracking-wide">{t('avgAqi')}</div>
                  </div>
                </div>
                <div className="glass rounded-2xl p-8 border border-cyan-500/20 hover-lift scale-in group relative overflow-hidden" style={{ transitionDelay: '0.2s' }}>
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative z-10">
                    <div className="text-5xl font-black text-cyan-400 mb-3">24/7</div>
                    <div className="text-gray-400 text-sm font-medium uppercase tracking-wide">{t('monitoring')}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
