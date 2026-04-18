'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { SensorMarker } from './SensorMarker';
import type { MapSensor } from '@/hooks/useSensorsOnMap';
import {
  sensorMatchesFilter,
  SENSOR_FILTER_OPTIONS,
  type SensorFilterValue,
} from '@/lib/map-aqi';
import type { MapStyleValue } from './types';

const MapViewDynamic = dynamic(
  () =>
    import('./MapView').then((m) => ({ default: m.MapView })),
  { ssr: false }
);

interface MapCardProps {
  sensors: MapSensor[];
  loading?: boolean;
  error?: string | null;
  onRefetch?: () => void;
  onSensorClick?: (sensor: MapSensor) => void;
}

export function MapCard({ sensors, loading, error, onRefetch, onSensorClick }: MapCardProps) {
  const t = useTranslations('map');
  const [mapStyle, setMapStyle] = useState<MapStyleValue>('standard');
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

  return (
    <article
      className="glass-strong rounded-3xl border border-green-500/30 overflow-hidden shadow-2xl hover-lift relative group scroll-reveal"
      aria-labelledby="map-card-title"
      aria-describedby="map-card-desc"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-green-500/8 via-emerald-500/4 to-cyan-500/8 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,255,136,0.1),transparent_50%)] pointer-events-none z-0" />

      {/* Header row */}
      <header className="relative bg-gradient-to-r from-[#0f0f0f] via-[#151515] to-[#1a1a1a] px-4 sm:px-6 md:px-8 py-4 md:py-5 border-b border-green-500/20 z-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2
              id="map-card-title"
              className="text-lg sm:text-xl md:text-2xl font-black text-white flex items-center gap-2 sm:gap-3 mb-1"
            >
              <span className="bg-gradient-to-r from-white to-green-100 bg-clip-text text-transparent">
                {t('title')}
              </span>
            </h2>
            <p id="map-card-desc" className="text-xs sm:text-sm text-gray-400 flex items-center gap-2">
              <span className="font-bold text-green-400 text-base sm:text-lg tabular-nums">
                {filter === 'all' ? sensors.length : activeCount}
              </span>
              <span>{t('activeSensor')}{activeCount !== 1 ? 's' : ''}</span>
            </p>
          </div>
          <div
            className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/40 rounded-full backdrop-blur-sm shadow-lg shadow-green-500/20"
            role="status"
            aria-live="polite"
            aria-label="Live data"
          >
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-green-300 text-xs font-bold tracking-wider">{t('live')}</span>
          </div>
        </div>
      </header>

      {/* Toolbar row */}
      <div className="relative flex flex-wrap items-center gap-2 sm:gap-4 px-4 sm:px-6 md:px-8 py-3 border-b border-green-500/20 bg-[#0d0d0d]/80 z-10">
        <div className="flex items-center gap-2" role="group" aria-label={t('styleGroup')}>
          <span className="text-xs text-gray-500 uppercase tracking-wider hidden sm:inline">{t('style')}</span>
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            {MAP_STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMapStyle(opt.value)}
                aria-pressed={mapStyle === opt.value}
                aria-label={`${t('styleGroup')}: ${t(opt.labelKey)}`}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  mapStyle === opt.value
                    ? 'bg-green-500/30 text-green-200 border-green-500/50'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
                }`}
              >
                {t(opt.labelKey)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2" role="group" aria-label={t('filterGroup')}>
          <span className="text-xs text-gray-500 uppercase tracking-wider hidden sm:inline">{t('filterLabel')}</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as SensorFilterValue)}
            aria-label={t('filterByAqi')}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50"
          >
            {SENSOR_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {filterLabel(opt.value)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main map area */}
      <div
        className="h-[380px] sm:h-[480px] md:h-[560px] relative z-20 overflow-hidden rounded-b-3xl"
        style={{ pointerEvents: 'auto' }}
      >
        {error && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-30 rounded-b-3xl gap-3"
            role="alert"
          >
            <p className="text-red-400 text-sm px-4 text-center">{error}</p>
            {onRefetch && (
              <button
                type="button"
                onClick={onRefetch}
                className="px-4 py-2 rounded-lg bg-green-500/20 text-green-300 border border-green-500/50 text-sm font-medium hover:bg-green-500/30"
              >
                {t('retry')}
              </button>
            )}
          </div>
        )}
        {loading && sensors.length === 0 ? (
          <div className="h-full flex items-center justify-center bg-[#0f0f0f] rounded-b-3xl" aria-busy="true">
            <div
              className="animate-spin rounded-full h-12 w-12 border-2 border-green-500/30 border-t-green-500"
              aria-hidden
            />
          </div>
        ) : (
          <>
            <MapViewDynamic
              sensors={filteredSensors}
              mapStyle={mapStyle}
            >
              {filteredSensors.map((sensor) => (
                <SensorMarker key={`${sensor.id}-${sensor.aqi}`} sensor={sensor} onClick={onSensorClick} />
              ))}
              {demoSensor && !filteredSensors.some((s) => s.id === demoSensor.id) && (
                <SensorMarker key={`demo-${demoSensor.id}-${demoSensor.aqi}`} sensor={demoSensor} onClick={onSensorClick} />
              )}
            </MapViewDynamic>

            {/* Empty-state overlay when user has no sensors */}
            {!loading && sensors.length === 0 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                <div className="px-5 py-3 rounded-xl bg-black/70 backdrop-blur-md border border-green-500/30 text-center pointer-events-auto">
                  <p className="text-sm text-gray-300">
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
