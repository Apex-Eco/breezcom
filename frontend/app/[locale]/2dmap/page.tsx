'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Cookies from 'js-cookie';
import Navigation from '@/components/Navigation';
import { authAPI } from '@/lib/api';
import { useSensorsOnMap, type MapSensor } from '@/hooks/useSensorsOnMap';
import type { MapStyleValue } from '@/components/map/types';

const TwoDMapCanvas = dynamic(() => import('@/components/map/TwoDMapCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <div className="h-14 w-14 animate-spin rounded-full border-4 border-theme border-t-green-400" />
    </div>
  ),
});

const SensorDetailPanel = dynamic(
  () => import('@/components/map/SensorDetailPanel').then((mod) => mod.SensorDetailPanel),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-48 items-center justify-center rounded-[30px] border border-theme bg-surface">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-theme border-t-green-400" />
      </div>
    ),
  }
);

const AQI_LEGEND = [
  { label: 'Good', range: '0-50', color: '#22c55e' },
  { label: 'Moderate', range: '51-100', color: '#eab308' },
  { label: 'Unhealthy', range: '101-200', color: '#f97316' },
  { label: 'Hazardous', range: '201+', color: '#8b5cf6' },
];

function MapSidebar({
  selectedSensor,
  onClearSelection,
}: {
  selectedSensor: MapSensor | null;
  onClearSelection: () => void;
}) {
  if (!selectedSensor) return null;

  return (
    <aside className="hidden h-full min-w-0 border-r border-theme bg-surface lg:flex lg:w-[390px] lg:flex-col xl:w-[420px]">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-theme px-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-primary">Station details</p>
          <p className="truncate text-xs text-muted">{selectedSensor.name || selectedSensor.site || 'Air station'}</p>
        </div>
        <button type="button" onClick={onClearSelection} className="wise-btn-secondary h-9 px-3 text-xs">
          Close
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <SensorDetailPanel sensor={selectedSensor} />
      </div>
    </aside>
  );
}

export default function Map2DPage() {
  const [user, setUser] = useState<any>(null);
  const [selectedSensor, setSelectedSensor] = useState<MapSensor | null>(null);
  const [defaultMapStyle, setDefaultMapStyle] = useState<MapStyleValue>('night');
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
    const updateStyleFromTheme = () => {
      setDefaultMapStyle(document.documentElement.dataset.theme === 'light' ? 'standard' : 'night');
    };

    updateStyleFromTheme();
    const observer = new MutationObserver(updateStyleFromTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setSelectedSensor((previous) => {
      if (!previous) return previous;
      const updated = sensors.find((sensor) => sensor.id === previous.id);
      return updated ?? null;
    });
  }, [sensors]);

  const closeSelectedSensor = () => setSelectedSensor(null);

  return (
    <main className="flex min-h-screen flex-col overflow-hidden page-shell">
      <Navigation user={user} onLogout={() => { Cookies.remove('token'); setUser(null); }} />

      <div className={`grid h-[calc(100dvh-4rem)] min-h-[520px] grid-cols-1 overflow-hidden border-t border-theme ${
        selectedSensor ? 'lg:grid-cols-[390px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)]' : ''
      }`}>
        <MapSidebar selectedSensor={selectedSensor} onClearSelection={closeSelectedSensor} />

        <section className="relative min-h-0 min-w-0 overflow-hidden bg-surface">
          <TwoDMapCanvas
            sensors={sensors}
            loading={loading}
            error={error}
            defaultMapStyle={defaultMapStyle}
            onSelectSensor={setSelectedSensor}
            onRetry={refetch}
          />

          {!selectedSensor ? (
            <div className="pointer-events-none absolute left-3 top-3 z-[650] max-w-[min(21rem,calc(100%-1.5rem))] rounded-2xl border border-theme bg-surface/95 p-4 shadow-xl backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#9fe870] text-lg font-black text-[#163300]">+</div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-primary">Breez Air Quality</p>
                  <p className="mt-1 text-xs text-secondary">{sensors.length} stations. Select a station on the map.</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {AQI_LEGEND.map((item) => (
                  <div key={item.label} className="flex min-w-0 items-center gap-2 text-[11px] font-bold text-muted">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="truncate">{item.range}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {selectedSensor ? (
            <div className="absolute inset-x-0 bottom-0 z-[760] max-h-[78%] rounded-t-[28px] border border-theme bg-surface shadow-2xl lg:hidden">
              <div className="flex h-12 items-center justify-between border-b border-theme px-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-primary">{selectedSensor.name || selectedSensor.site || 'Air station'}</p>
                </div>
                <button type="button" onClick={closeSelectedSensor} className="wise-btn-secondary h-8 px-3 text-xs">
                  Close
                </button>
              </div>
              <div className="max-h-[calc(78dvh-3rem)] overflow-y-auto p-3">
                <SensorDetailPanel sensor={selectedSensor} />
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
