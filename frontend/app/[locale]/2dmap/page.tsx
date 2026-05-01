'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Cookies from 'js-cookie';
import Navigation from '@/components/Navigation';
import { Link } from '@/i18n/navigation';
import { authAPI } from '@/lib/api';
import { useSensorsOnMap, type MapSensor } from '@/hooks/useSensorsOnMap';

const TwoDMapCanvas = dynamic(() => import('@/components/map/TwoDMapCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <div className="h-14 w-14 animate-spin rounded-full border-4 border-theme border-t-green-400" />
    </div>
  ),
});

export default function Map2DPage() {
  const [user, setUser] = useState<any>(null);
  const [selectedSensor, setSelectedSensor] = useState<MapSensor | null>(null);
  const { sensors, loading, error, refetch } = useSensorsOnMap({
    userId: user?.id ?? null,
    refetchIntervalMs: 60_000,
  });

  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) return;

    authAPI.getMe().then(setUser).catch(() => Cookies.remove('token'));
  }, []);

  useEffect(() => {
    setSelectedSensor((previous) => {
      if (!previous) return previous;
      const updated = sensors.find((sensor) => sensor.id === previous.id);
      return updated ?? null;
    });
  }, [sensors]);

  return (
    <main className="min-h-screen page-shell">
      <Navigation user={user} onLogout={() => { Cookies.remove('token'); setUser(null); }} />

      <div className="px-4 pb-4 pt-20">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-primary sm:text-4xl">2D Map</h1>
            <p className="text-sm text-muted sm:text-base">
              Dedicated full-page Leaflet map for the same live sensors shown on the dashboard.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-3 rounded-full border border-theme bg-white/5 px-4 py-2 text-sm text-secondary">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10b981]" />
              </span>
              <span>{sensors.length} sensors</span>
              <span className="text-muted">refresh 60s</span>
            </div>
            <Link
              href="/"
              className="rounded-full border border-theme bg-white/5 px-4 py-2 text-sm font-medium text-primary hover:bg-white/10"
            >
              Back to dashboard
            </Link>
            <Link
              href="/3d-map"
              className="rounded-full border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-medium text-green-300 hover:bg-green-500/15"
            >
              Open 3D globe
            </Link>
          </div>
        </div>

        <div className="relative h-[calc(100vh-7rem)] min-h-[640px] overflow-hidden rounded-2xl border border-theme bg-surface">
          <TwoDMapCanvas
            sensors={sensors}
            loading={loading}
            error={error}
            selectedSensor={selectedSensor}
            onSelectSensor={setSelectedSensor}
            onRetry={refetch}
          />
        </div>
      </div>
    </main>
  );
}
