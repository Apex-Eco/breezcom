'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useSensorsOnMap, type MapSensor } from '@/hooks/useSensorsOnMap';
import { SensorMarker } from './SensorMarker';
import { SensorDetailPanel } from './SensorDetailPanel';

const MapViewDynamic = dynamic(
  () => import('./MapView').then((m) => ({ default: m.MapView })),
  { ssr: false }
);

export default function AlmatyMap() {
  const { sensors, loading, error, refetch } = useSensorsOnMap({
    userId: null,
    refetchIntervalMs: 5000,
  });
  const [selectedSensor, setSelectedSensor] = useState<MapSensor | null>(null);

  // Auto-select first sensor + refresh selected data
  useEffect(() => {
    if (sensors.length > 0) {
      if (!selectedSensor) {
        setSelectedSensor(sensors[0]);
      } else {
        const updated = sensors.find((s) => s.id === selectedSensor.id);
        if (updated) setSelectedSensor(updated);
      }
    }
  }, [sensors]);

  return (
    <div>
      <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-4 sm:mb-6">
        Интерактивная карта качества воздуха
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2 h-[400px] sm:h-[500px] md:h-[600px] rounded-xl sm:rounded-2xl overflow-hidden relative">
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-30 rounded-2xl gap-3">
              <p className="text-red-400 text-sm px-4 text-center">{error}</p>
              <button
                type="button"
                onClick={refetch}
                className="px-4 py-2 rounded-lg bg-green-500/20 text-green-300 border border-green-500/50 text-sm font-medium hover:bg-green-500/30"
              >
                Повторить
              </button>
            </div>
          )}
          {loading && sensors.length === 0 ? (
            <div className="h-full flex items-center justify-center bg-[#0f0f0f] rounded-2xl">
              <div className="animate-spin rounded-full h-12 w-12 border-2 border-green-500/30 border-t-green-500" />
            </div>
          ) : (
            <MapViewDynamic sensors={sensors} mapStyle="standard">
              {sensors.map((sensor) => (
                <SensorMarker key={`${sensor.id}-${sensor.aqi}`} sensor={sensor} onClick={setSelectedSensor} />
              ))}
            </MapViewDynamic>
          )}

          {!loading && sensors.length === 0 && !error && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
              <div className="px-5 py-3 rounded-xl bg-black/70 backdrop-blur-md border border-green-500/30 text-center">
                <p className="text-sm text-gray-300">Нет активных датчиков</p>
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div>
          {selectedSensor ? (
            <SensorDetailPanel sensor={selectedSensor} />
          ) : (
            <div className="glass-strong rounded-3xl border border-green-500/30 p-8 text-center h-full flex flex-col items-center justify-center">
              <div className="text-4xl mb-3">📍</div>
              <p className="text-gray-400 text-sm">Нажмите на датчик на карте</p>
            </div>
          )}
        </div>
      </div>

      {sensors.length > 0 && (
        <div className="mt-4 flex items-center gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span>{sensors.length} активных датчиков</span>
          </div>
          <span className="text-gray-600">|</span>
          <span>Обновление каждые 5 сек</span>
        </div>
      )}
    </div>
  );
}
