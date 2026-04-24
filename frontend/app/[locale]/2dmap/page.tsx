'use client';

import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import Navigation from '@/components/Navigation';
import { Link } from '@/i18n/navigation';
import { authAPI } from '@/lib/api';
import { useSensorsOnMap, type MapSensor } from '@/hooks/useSensorsOnMap';
import { MapView } from '@/components/map/MapView';
import { SensorMarker } from '@/components/map/SensorMarker';
import { SensorDetailPanel } from '@/components/map/SensorDetailPanel';

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
    <main className="min-h-screen bg-black">
      <Navigation user={user} onLogout={() => { Cookies.remove('token'); setUser(null); }} />

      <div className="px-4 pb-4 pt-20">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">2D Map</h1>
            <p className="text-sm text-gray-400 sm:text-base">
              Dedicated full-page Leaflet map for the same live sensors shown on the dashboard.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10b981]" />
              </span>
              <span>{sensors.length} sensors</span>
              <span className="text-gray-500">refresh 60s</span>
            </div>
            <Link
              href="/"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
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

        <div className="relative h-[calc(100vh-7rem)] min-h-[640px] overflow-hidden rounded-2xl border border-white/10 bg-[#08090a]">
          <section className="relative h-full w-full">
            {error ? (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/80">
                <p className="px-4 text-center text-sm text-gray-200">{error}</p>
                <button
                  type="button"
                  onClick={refetch}
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
                >
                  Retry
                </button>
              </div>
            ) : null}

            {loading && sensors.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-14 w-14 animate-spin rounded-full border-4 border-white/10 border-t-green-400" />
              </div>
            ) : (
              <MapView sensors={sensors} mapStyle="dark" className="h-full rounded-none" mapActionHref={null}>
                {sensors.map((sensor) => (
                  <SensorMarker
                    key={`${sensor.id}-${sensor.aqi}`}
                    sensor={sensor}
                    onClick={setSelectedSensor}
                    showPopup={false}
                  />
                ))}
              </MapView>
            )}
            {selectedSensor ? (
              <div className="pointer-events-none absolute right-4 top-4 z-[700] w-[min(360px,calc(100%-2rem))]">
                <div className="pointer-events-auto relative">
                  <button
                    type="button"
                    onClick={() => setSelectedSensor(null)}
                    className="absolute right-3 top-3 z-10 rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-xs font-medium text-white hover:bg-black/70"
                  >
                    Close
                  </button>
                  <SensorDetailPanel sensor={selectedSensor} />
                </div>
              </div>
            ) : (
              <div className="pointer-events-none absolute bottom-4 right-4 z-[700] rounded-xl border border-white/10 bg-black/55 px-4 py-3 text-sm text-gray-300 backdrop-blur-md">
                Click any marker to open the live sensor card.
              </div>
            )}
          </section>

        </div>
      </div>
    </main>
  );
}
