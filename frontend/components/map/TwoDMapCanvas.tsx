'use client';

import { MapView } from '@/components/map/MapView';
import { SensorDetailPanel } from '@/components/map/SensorDetailPanel';
import { SensorMarker } from '@/components/map/SensorMarker';
import type { MapSensor } from '@/hooks/useSensorsOnMap';

interface TwoDMapCanvasProps {
  sensors: MapSensor[];
  loading: boolean;
  error: string | null;
  selectedSensor: MapSensor | null;
  onSelectSensor: (sensor: MapSensor | null) => void;
  onRetry: () => void;
}

export default function TwoDMapCanvas({
  sensors,
  loading,
  error,
  selectedSensor,
  onSelectSensor,
  onRetry,
}: TwoDMapCanvasProps) {
  return (
    <section className="relative h-full w-full">
      {error ? (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/80">
          <p className="px-4 text-center text-sm text-gray-200">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="wise-btn-secondary px-4 py-2 text-sm"
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading && sensors.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-theme border-t-green-400" />
        </div>
      ) : (
        <MapView sensors={sensors} mapStyle="dark" className="h-full rounded-none" mapActionHref={null}>
          {sensors.map((sensor) => (
            <SensorMarker
              key={`${sensor.id}-${sensor.aqi}`}
              sensor={sensor}
              onClick={onSelectSensor}
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
              onClick={() => onSelectSensor(null)}
              className="absolute right-3 top-3 z-10 wise-btn-secondary px-2.5 py-1 text-xs"
            >
              Close
            </button>
            <SensorDetailPanel sensor={selectedSensor} />
          </div>
        </div>
      ) : (
        <div className="pointer-events-none absolute bottom-4 right-4 z-[700] rounded-xl border border-theme bg-black/55 px-4 py-3 text-sm text-secondary backdrop-blur-md">
          Click any marker to open the live sensor card.
        </div>
      )}
    </section>
  );
}
