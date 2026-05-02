'use client';

import { MapView } from '@/components/map/MapView';
import { SensorMarker } from '@/components/map/SensorMarker';
import type { MapSensor } from '@/hooks/useSensorsOnMap';
import type { MapStyleValue } from './types';

interface TwoDMapCanvasProps {
  sensors: MapSensor[];
  loading: boolean;
  error: string | null;
  defaultMapStyle: MapStyleValue;
  onSelectSensor: (sensor: MapSensor | null) => void;
  onRetry: () => void;
}

export default function TwoDMapCanvas({
  sensors,
  loading,
  error,
  defaultMapStyle,
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
        <div className="flex h-full items-center justify-center bg-surface">
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-theme border-t-green-400" />
        </div>
      ) : (
        <MapView
          sensors={sensors}
          mapStyle={defaultMapStyle}
          className="h-full rounded-none"
          mapActionHref={null}
          showStyleControl
        >
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
    </section>
  );
}
