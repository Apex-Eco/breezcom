'use client';

import { useState, useEffect } from 'react';
import { MapView } from './MapView';
import { useSensorsOnMap, type MapSensor } from '@/hooks/useSensorsOnMap';
import { SensorMarker } from './SensorMarker';
import { SensorDetailPanel } from './SensorDetailPanel';

export default function AlmatyMap() {
  const { sensors, loading, error, refetch } = useSensorsOnMap({
    userId: null,
    refetchIntervalMs: 60_000,
  });
  const [selectedSensor, setSelectedSensor] = useState<MapSensor | null>(null);

  // Auto-select first sensor + refresh selected data
  useEffect(() => {
    if (sensors.length === 0) return;
    setSelectedSensor((previous) => {
      if (!previous) return sensors[0];
      const updated = sensors.find((sensor) => sensor.id === previous.id);
      return updated ?? sensors[0];
    });
  }, [sensors]);

  // [restyle]
  return (
    <div>
      <h2 className="mb-4 text-xl font-[510] tracking-[-0.24px] text-[#f7f8f8] sm:mb-6 sm:text-2xl md:text-3xl">
        Интерактивная карта качества воздуха
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2 h-[400px] sm:h-[500px] md:h-[600px] rounded-xl sm:rounded-2xl overflow-hidden relative">
          {error && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 rounded-2xl bg-[rgba(0,0,0,0.85)]">
              <p className="px-4 text-center text-sm text-[#d0d6e0]">{error}</p>
              <button
                type="button"
                onClick={refetch}
                className="rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-sm font-[510] text-[#d0d6e0] hover:bg-[rgba(255,255,255,0.05)]"
              >
                Повторить
              </button>
            </div>
          )}
          {loading && sensors.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-2xl bg-surface">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-[rgba(255,255,255,0.08)] border-t-[#5e6ad2]" />
            </div>
          ) : (
            <MapView sensors={sensors} mapStyle="standard">
              {sensors.map((sensor) => (
                <SensorMarker key={`${sensor.id}-${sensor.aqi}`} sensor={sensor} onClick={setSelectedSensor} />
              ))}
            </MapView>
          )}

          {!loading && sensors.length === 0 && !error && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
              <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-5 py-3 text-center backdrop-blur-md">
                <p className="text-sm text-[#8a8f98]">Нет активных датчиков</p>
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div>
          {selectedSensor ? (
            <SensorDetailPanel sensor={selectedSensor} />
          ) : (
            <div
              className="flex h-full flex-col items-center justify-center rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0f1011] p-8 text-center"
              style={{
                boxShadow:
                  'rgba(0,0,0,0.2) 0px 0px 0px 1px, rgba(0,0,0,0.4) 0px 2px 4px',
                fontFeatureSettings: '"cv01", "ss03"',
              }}
            >
              <div className="text-4xl mb-3">📍</div>
              <p className="text-sm text-[#8a8f98]">Нажмите на датчик на карте</p>
            </div>
          )}
        </div>
      </div>

      {sensors.length > 0 && (
        <div className="mt-4 flex items-center gap-4 text-sm text-[#8a8f98]" style={{ fontFeatureSettings: '"cv01", "ss03"' }}>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10b981]" />
            </span>
            <span>{sensors.length} активных датчиков</span>
          </div>
          <span className="text-[#62666d]">|</span>
          <span>Обновление каждые 60 сек</span>
        </div>
      )}
    </div>
  );
}
