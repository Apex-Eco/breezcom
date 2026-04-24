'use client';

import { useEffect, useState, useRef } from 'react';
import { authAPI } from '@/lib/api';
import { useSensorsOnMap } from '@/hooks/useSensorsOnMap';
import AuthModal from '@/components/AuthModal';
import Navigation from '@/components/Navigation';
import Cookies from 'js-cookie';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function Home() {
  const t = useTranslations('home');
  const tCommon = useTranslations('common');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  const { sensors } = useSensorsOnMap({
    userId: user?.id ?? null,
    refetchIntervalMs: 60_000,
  });

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
            <div ref={heroRef} className="relative container mx-auto px-4 py-14 md:py-20 border-b border-green-500/20 scroll-reveal">
              <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-[12px] font-[510] tracking-[0.08em] text-green-300 mb-7 backdrop-blur-md">
                <div className="relative">
                  <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse" />
                  <div className="absolute inset-0 w-2.5 h-2.5 bg-green-400 rounded-full animate-ping opacity-75" />
                </div>
                <span className="tracking-wide">{t('realtimeBadge')}</span>
              </div>
              <h1 className="max-w-5xl text-4xl sm:text-5xl md:text-6xl xl:text-7xl font-[510] tracking-[-0.04em] mb-6 md:mb-7 leading-[0.96]">
                <span className="bg-gradient-to-r from-white via-green-100 via-emerald-200 to-cyan-200 bg-clip-text text-transparent block mb-3">
                  {t('airQuality')}
                </span>
                <span className="bg-gradient-to-r from-green-400 via-emerald-400 to-cyan-400 bg-clip-text text-transparent block">
                  {t('inAlmaty')}
                </span>
              </h1>
              <p className="text-[15px] sm:text-[16px] md:text-[18px] text-[#d0d6e0] max-w-3xl leading-[1.6] mb-8 md:mb-10">
                {t('subtitle')}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className="px-5 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-md text-white font-[510] shadow-2xl shadow-green-500/30 transition-transform cursor-pointer text-center text-[14px] sm:text-[15px]">
                  {t('startMonitoring')}
                </div>
                <div className="px-5 sm:px-6 py-2.5 sm:py-3 border border-[rgba(255,255,255,0.08)] rounded-md text-[#d0d6e0] font-[510] hover:bg-white/5 transition-all cursor-pointer text-center text-[14px] sm:text-[15px]">
                  {t('learnMore')}
                </div>
              </div>
            </div>
          </div>

          <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 md:py-16 section-transition">
            <div className="mb-8 md:mb-12 grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_0.7fr]">
              <section className="glass rounded-3xl border border-green-500/20 p-6 md:p-8">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-green-300/80">Command Center</div>
                    <h2 className="mt-2 text-2xl font-black text-white md:text-3xl">Live map routes and sensor coverage</h2>
                  </div>
                  <div className="rounded-full border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm text-green-200">
                    Updates every 60 sec
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <Link href="/2dmap" className="group rounded-2xl border border-cyan-500/20 bg-[linear-gradient(135deg,rgba(6,182,212,0.16),rgba(15,23,42,0.8))] p-5 hover:border-cyan-400/40 transition">
                    <div className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Route</div>
                    <div className="mt-2 text-2xl font-black text-white">2D Map</div>
                    <p className="mt-2 text-sm text-gray-300">Full-screen Leaflet view with live sensor details.</p>
                  </Link>
                  <Link href="/3d-map" className="group rounded-2xl border border-green-500/20 bg-[linear-gradient(135deg,rgba(34,197,94,0.15),rgba(15,23,42,0.8))] p-5 hover:border-green-400/40 transition">
                    <div className="text-xs uppercase tracking-[0.2em] text-green-200/80">Route</div>
                    <div className="mt-2 text-2xl font-black text-white">3D Globe</div>
                    <p className="mt-2 text-sm text-gray-300">Global view for seeded locations and live air-quality points.</p>
                  </Link>
                  <Link href="/sensors" className="group rounded-2xl border border-emerald-500/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(15,23,42,0.8))] p-5 hover:border-emerald-400/40 transition">
                    <div className="text-xs uppercase tracking-[0.2em] text-emerald-200/80">Access</div>
                    <div className="mt-2 text-2xl font-black text-white">Sensors</div>
                    <p className="mt-2 text-sm text-gray-300">Open sensor inventory and manage the available monitoring points.</p>
                  </Link>
                </div>
              </section>

              <section className="glass rounded-3xl border border-white/10 p-6 md:p-8">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-400">Live Snapshot</div>
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-gray-400">Tracked sensors</div>
                    <div className="mt-2 text-4xl font-black text-white">{sensors.length}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-gray-400">Average AQI</div>
                    <div className="mt-2 text-4xl font-black text-white">
                      {sensors.length > 0 ? Math.round(sensors.reduce((sum, s) => sum + s.aqi, 0) / sensors.length) : 0}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-gray-400">Refresh cycle</div>
                    <div className="mt-2 text-4xl font-black text-white">60s</div>
                  </div>
                </div>
              </section>
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
