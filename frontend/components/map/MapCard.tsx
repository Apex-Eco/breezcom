'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MapView } from './MapView';
import { SensorMarker } from './SensorMarker';
import type { MapSensor } from '@/hooks/useSensorsOnMap';
import {
  sensorMatchesFilter,
  SENSOR_FILTER_OPTIONS,
  type SensorFilterValue,
} from '@/lib/map-aqi';
import type { MapStyleValue } from './types';

interface MapCardProps {
  sensors: MapSensor[];
  loading?: boolean;
  error?: string | null;
  onRefetch?: () => void;
  onSensorClick?: (sensor: MapSensor) => void;
}

export function MapCard({ sensors, loading, error, onRefetch, onSensorClick }: MapCardProps) {
  const t = useTranslations('map');
  const [mapStyle, setMapStyle] = useState<MapStyleValue>('dark');
  const [filter, setFilter] = useState<SensorFilterValue>('all');

  const MAP_STYLE_OPTIONS: { value: MapStyleValue; labelKey: string }[] = useMemo(
    () => [
      { value: 'standard', labelKey: 'standard' },
      { value: 'dark', labelKey: 'styleDark' },
      { value: 'satellite', labelKey: 'styleSatellite' },
    ],
    []
  );

  const filterLabel = (value: SensorFilterValue) => {
    if (value === 'all') return t('filter.all');
    const key =
      value === 'good'
        ? 'good'
        : value === 'moderate'
          ? 'moderate'
          : value === 'unhealthySensitive'
            ? 'unhealthySensitive'
            : value === 'unhealthy'
              ? 'unhealthy'
              : 'veryUnhealthy';
    return t(`aqi.${key}`);
  };

  const filteredSensors = useMemo(
    () => sensors.filter((s) => sensorMatchesFilter(s.aqi, filter)),
    [sensors, filter]
  );
  const demoSensor = useMemo(() => sensors.find((s) => s.isDemo), [sensors]);
  const activeCount = filteredSensors.length;

  // [restyle]
  return (
    <article
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0f1011] scroll-reveal"
      style={{
        boxShadow:
          'rgba(0,0,0,0.2) 0px 0px 0px 1px, rgba(0,0,0,0.4) 0px 2px 4px',
        fontFeatureSettings: '"cv01", "ss03"',
      }}
      aria-labelledby="map-card-title"
      aria-describedby="map-card-desc"
    >
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-[rgba(255,255,255,0.02)] px-4 py-3 sm:px-5 md:px-6">
        <div>
          <h2
            id="map-card-title"
            className="text-[15px] font-[590] tracking-[-0.165px] text-[#f7f8f8] sm:text-base"
          >
            {t('title')}
          </h2>
          <p id="map-card-desc" className="mt-1 flex items-center gap-2 text-[12px] text-[#8a8f98]">
            <span className="font-[590] tabular-nums text-[#d0d6e0]">
              {filter === 'all' ? sensors.length : activeCount}
            </span>
            <span>{t('activeSensor')}{activeCount !== 1 ? 's' : ''}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]">
            {MAP_STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMapStyle(opt.value)}
                aria-pressed={mapStyle === opt.value}
                aria-label={`${t('styleGroup')}: ${t(opt.labelKey)}`}
                className={`px-3 py-1.5 text-[12px] font-[510] transition-colors ${
                  mapStyle === opt.value
                    ? 'bg-[#5e6ad2] text-white'
                    : 'bg-transparent text-[#8a8f98] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#d0d6e0]'
                }`}
              >
                {t(opt.labelKey)}
              </button>
            ))}
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as SensorFilterValue)}
            aria-label={t('filterByAqi')}
            className="rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-3 py-1.5 text-[12px] font-[510] text-[#d0d6e0] focus:border-[#7170ff] focus:outline-none"
          >
            {SENSOR_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {filterLabel(opt.value)}
              </option>
            ))}
          </select>
          <div
            className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5"
            role="status"
            aria-live="polite"
            aria-label="Live data"
          >
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10b981]" />
            </span>
            <span className="text-[11px] font-[510] tracking-[0.08em] text-[#d0d6e0]">{t('live')}</span>
          </div>
        </div>
      </div>

      <div
        className="relative z-20 h-[420px] overflow-hidden rounded-b-2xl sm:h-[520px] md:h-[620px]"
        style={{ pointerEvents: 'auto' }}
      >
        {error && (
          <div
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 rounded-b-xl bg-[rgba(0,0,0,0.85)]"
            role="alert"
          >
            <p className="px-4 text-center text-sm text-[#d0d6e0]">{error}</p>
            {onRefetch && (
              <button
                type="button"
                onClick={onRefetch}
                className="rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-sm font-[510] text-[#d0d6e0] hover:bg-[rgba(255,255,255,0.05)]"
              >
                {t('retry')}
              </button>
            )}
          </div>
        )}
        {loading && sensors.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-b-xl bg-[#08090a]" aria-busy="true">
            <div
              className="h-12 w-12 animate-spin rounded-full border-2 border-[rgba(255,255,255,0.08)] border-t-[#5e6ad2]"
              aria-hidden
            />
          </div>
        ) : (
          <>
            <MapView
              sensors={filteredSensors}
              mapStyle={mapStyle}
            >
              {filteredSensors.map((sensor) => (
                <SensorMarker key={`${sensor.id}-${sensor.aqi}`} sensor={sensor} onClick={onSensorClick} />
              ))}
              {demoSensor && !filteredSensors.some((s) => s.id === demoSensor.id) && (
                <SensorMarker key={`demo-${demoSensor.id}-${demoSensor.aqi}`} sensor={demoSensor} onClick={onSensorClick} />
              )}
            </MapView>

            {/* Empty-state overlay when user has no sensors */}
            {!loading && sensors.length === 0 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                <div className="pointer-events-auto rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-5 py-3 text-center backdrop-blur-md">
                  <p className="text-sm text-[#8a8f98]">
                    {t('emptyState')}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </article>
  );
}
