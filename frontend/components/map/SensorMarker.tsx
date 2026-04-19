'use client';

import { useMemo, useCallback, memo } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useTranslations } from 'next-intl';
import type { MapSensor } from '@/hooks/useSensorsOnMap';
import { getAqiCategory, getAqiColor } from '@/lib/map-aqi';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getMarkerDeviceLabel(sensor: MapSensor): string {
  const candidates = [
    sensor.device_name,
    sensor.device_id,
    sensor.name,
    sensor.label,
    sensor.site,
  ];
  for (const item of candidates) {
    if (typeof item === 'string' && item.trim()) {
      return item.trim();
    }
  }
  return `Sensor #${sensor.markerIndex ?? 1}`;
}

function createMarkerIcon(sensor: MapSensor): L.DivIcon {
  // [aqi-color]
  const aqi = sensor.aqi;
  const isDemo = Boolean(sensor.isDemo);
  const isPurchased = sensor.isPurchased;
  const category = getAqiCategory(aqi);
  const color = getAqiColor(aqi);
  const textColor = category.textColor;
  const size = category.isDangerous ? 50 : 46;
  const label = escapeHtml(getMarkerDeviceLabel(sensor));
  const classes = [
    'marker-aqi-bubble',
    category.isDangerous ? 'marker-glow marker-danger-pulse' : 'marker-glow',
    isPurchased && 'marker-purchased',
    isDemo && 'marker-demo',
  ].filter(Boolean) as string[];

  const html = `
    <div class="marker-aqi-wrap" role="img" aria-label="Sensor AQI ${aqi}, ${category.label}, ${label}">
      <div
        class="${classes.join(' ')}"
        style="--aqi-color: ${color}; --aqi-size: ${size}px; --aqi-border-color: ${color}; color: ${textColor};"
      >
        ${category.isDangerous ? '<span class="marker-badge-danger" aria-hidden></span>' : ''}
        ${isPurchased ? '<span class="marker-badge-purchased" aria-hidden>🛒</span>' : ''}
        ${isDemo ? '<span class="marker-badge-demo" aria-hidden>DEMO</span>' : ''}
        <span class="marker-value">${aqi}</span>
      </div>
      <span class="marker-device-label">${label}</span>
    </div>
  `;

  const iconWidth = Math.max(size + 24, 86);
  const iconHeight = size + 24;

  return L.divIcon({
    className: 'custom-marker',
    html,
    iconSize: [iconWidth, iconHeight],
    iconAnchor: [iconWidth / 2, size / 2],
  });
}

function formatLastUpdated(ts?: string): string {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return ts;
  }
}

interface SensorMarkerProps {
  sensor: MapSensor;
  onClick?: (sensor: MapSensor) => void;
}

function SensorMarkerInner({ sensor, onClick }: SensorMarkerProps) {
  const t = useTranslations('map');
  const tCommon = useTranslations('common');
  const icon = useMemo(() => createMarkerIcon(sensor), [sensor]);
  const position: [number, number] = [sensor.lat, sensor.lng];
  const params = sensor.parameters ?? {};
  const aqi = sensor.aqi;
  const category = getAqiCategory(aqi);
  const aqiLabel = t(`aqi.${category.key}`);
  const eventHandlers = useCallback(() => ({
    click: () => onClick?.(sensor),
  }), [sensor, onClick]);

  // [restyle]
  if (sensor.isPurchased) {
    return (
      <Marker position={position} icon={icon} eventHandlers={eventHandlers()}>
        <Popup className="custom-popup" aria-label={`Sensor details: ${sensor.name ?? t('purchased')}`}>
          {/* [restyle] */}
          <div
            className="min-w-[240px] rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#191a1b] p-3 text-[#d0d6e0] sm:min-w-[320px] sm:p-4 md:p-5"
            style={{
              boxShadow:
                'rgba(0,0,0,0.2) 0px 0px 0px 1px, rgba(0,0,0,0.4) 0px 2px 4px',
              fontFeatureSettings: '"cv01", "ss03"',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-[590] tracking-[-0.24px] text-[#f7f8f8] sm:text-xl">
                {sensor.name ?? t('purchased')}
              </h3>
              <span className="rounded-sm border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.05)] px-2 py-1 text-[10px] font-[510] tracking-[0.08em] text-[#f7f8f8]">
                {t('purchasedBadge')}
              </span>
            </div>
            <p className="mb-4 text-xs text-[#8a8f98] sm:text-sm">
              {sensor.city ?? 'Unknown'}, {sensor.country ?? 'Unknown'}
            </p>
            <div
              className="mb-4 rounded-lg border border-[rgba(255,255,255,0.08)] px-4 py-3 text-center"
              style={{ backgroundColor: category.color, color: category.textColor }}
            >
              <div className="mb-1 text-3xl font-[590] leading-none">{aqi}</div>
              <div className="text-sm font-[510] opacity-90">{tCommon('indexAqi')}</div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-3">
                <div className="mb-1 text-xs text-[#8a8f98]">PM2.5</div>
                <div className="text-lg font-[510] text-[#f7f8f8]">{(params.pm25 ?? 0).toFixed(1)}</div>
                <div className="text-xs text-[#62666d]">µg/m³</div>
              </div>
              <div className="rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-3">
                <div className="mb-1 text-xs text-[#8a8f98]">PM10</div>
                <div className="text-lg font-[510] text-[#f7f8f8]">{(params.pm10 ?? 0).toFixed(1)}</div>
                <div className="text-xs text-[#62666d]">µg/m³</div>
              </div>
            </div>
            {(params.co2 ?? params.voc ?? params.co ?? params.o3 ?? params.no2 ?? params.ch2o) != null && (
              <div className="mb-3 border-t border-[rgba(255,255,255,0.08)] pt-3">
                <div className="mb-2 text-[11px] font-[510] uppercase tracking-[0.08em] text-[#8a8f98]">{tCommon('additionalParams')}</div>
                <div className="grid grid-cols-2 gap-2">
                  {params.co2 != null && (
                    <div className="rounded-md bg-[rgba(255,255,255,0.02)] p-2">
                      <div className="text-xs text-[#62666d]">CO₂</div>
                      <div className="text-sm font-[510] text-[#d0d6e0]">{(params.co2 ?? 0).toFixed(1)} ppm</div>
                    </div>
                  )}
                  {params.voc != null && (
                    <div className="rounded-md bg-[rgba(255,255,255,0.02)] p-2">
                      <div className="text-xs text-[#62666d]">VOC</div>
                      <div className="text-sm font-[510] text-[#d0d6e0]">{(params.voc ?? 0).toFixed(2)} ppm</div>
                    </div>
                  )}
                  {params.co != null && (
                    <div className="rounded-md bg-[rgba(255,255,255,0.02)] p-2">
                      <div className="text-xs text-[#62666d]">CO</div>
                      <div className="text-sm font-[510] text-[#d0d6e0]">{(params.co ?? 0).toFixed(2)} ppm</div>
                    </div>
                  )}
                  {params.o3 != null && (
                    <div className="rounded-md bg-[rgba(255,255,255,0.02)] p-2">
                      <div className="text-xs text-[#62666d]">O₃</div>
                      <div className="text-sm font-[510] text-[#d0d6e0]">{(params.o3 ?? 0).toFixed(1)} ppb</div>
                    </div>
                  )}
                  {params.no2 != null && (
                    <div className="rounded-md bg-[rgba(255,255,255,0.02)] p-2">
                      <div className="text-xs text-[#62666d]">NO₂</div>
                      <div className="text-sm font-[510] text-[#d0d6e0]">{(params.no2 ?? 0).toFixed(1)} ppb</div>
                    </div>
                  )}
                  {params.ch2o != null && (
                    <div className="rounded-md bg-[rgba(255,255,255,0.02)] p-2">
                      <div className="text-xs text-[#62666d]">CH₂O</div>
                      <div className="text-sm font-[510] text-[#d0d6e0]">{(params.ch2o ?? 0).toFixed(3)} ppm</div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {sensor.description && (
              <div className="border-t border-[rgba(255,255,255,0.08)] pt-3 text-xs text-[#8a8f98]">
                {sensor.description}
              </div>
            )}
          </div>
        </Popup>
      </Marker>
    );
  }

  const data = sensor.airQualityData;
  const pm1  = data?.current?.pollution?.pm1  ?? params.pm1  ?? 0;
  const pm25 = data?.current?.pollution?.pm25 ?? params.pm25 ?? 0;
  const pm10 = data?.current?.pollution?.pm10 ?? params.pm10 ?? 0;
  const co2  = data?.current?.pollution?.co2  ?? params.co2  ?? 0;
  const co   = data?.current?.pollution?.co   ?? params.co   ?? 0;
  const no2  = data?.current?.pollution?.no2  ?? params.no2  ?? 0;
  const o3   = data?.current?.pollution?.o3   ?? params.o3   ?? 0;
  const voc  = params.voc  ?? 0;
  const ch2o = params.ch2o ?? 0;
  const temp = data?.current?.weather?.tp ?? params.temp ?? null;
  const hum  = data?.current?.weather?.hu ?? params.hum  ?? null;
  const ts   = data?.current?.pollution?.ts;
  const siteName = data?.sensor_data?.site ?? sensor.name ?? data?.city ?? 'Station';
  const locationText = [sensor.city ?? data?.city ?? '', sensor.country ?? data?.country ?? ''].filter(Boolean).join(', ') || '—';

  // [restyle]
  return (
    <Marker position={position} icon={icon} eventHandlers={eventHandlers()}>
      <Popup className="custom-popup" maxWidth={360} aria-label={`Sensor details: ${siteName}`}>
        {/* [restyle] */}
        <div
          className="max-w-[360px] min-w-[300px] rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#191a1b] p-4 text-[#d0d6e0]"
          style={{
            boxShadow:
              'rgba(0,0,0,0.2) 0px 0px 0px 1px, rgba(0,0,0,0.4) 0px 2px 4px',
            fontFeatureSettings: '"cv01", "ss03"',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-[590] tracking-[-0.24px] text-[#f7f8f8]">{siteName}</h3>
            {category.isDangerous && (
              <span className="rounded-sm border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.05)] px-2 py-1 text-[10px] font-[510] tracking-[0.08em] text-[#f7f8f8]">
                {t('dangerBadge')}
              </span>
            )}
          </div>
          <p className="mb-3 text-xs text-[#8a8f98]">{locationText}</p>

          {/* AQI badge */}
          <div
            className="mb-4 rounded-lg border border-[rgba(255,255,255,0.08)] px-4 py-3 text-center"
            style={{ backgroundColor: category.color, color: category.textColor }}
          >
            <div className="mb-0.5 text-3xl font-[590] leading-none">{aqi}</div>
            <div className="text-xs font-[510] opacity-90">{aqiLabel}</div>
          </div>

          {/* Particles section */}
          <div className="mb-3">
            <div className="mb-1.5 text-[11px] font-[510] uppercase tracking-[0.08em] text-[#8a8f98]">Частицы</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-2 text-center">
                <div className="text-[10px] text-[#62666d]">PM1</div>
                <div className="text-lg font-[510] leading-tight text-[#f7f8f8]">{pm1.toFixed(0)}</div>
                <div className="text-[9px] text-[#62666d]">µg/m³</div>
              </div>
              <div className="rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-2 text-center">
                <div className="text-[10px] font-[510] text-[#d0d6e0]">PM2.5</div>
                <div className="text-lg font-[510] leading-tight text-[#f7f8f8]">{pm25.toFixed(1)}</div>
                <div className="text-[9px] text-[#62666d]">µg/m³</div>
              </div>
              <div className="rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-2 text-center">
                <div className="text-[10px] text-[#62666d]">PM10</div>
                <div className="text-lg font-[510] leading-tight text-[#f7f8f8]">{pm10.toFixed(0)}</div>
                <div className="text-[9px] text-[#62666d]">µg/m³</div>
              </div>
            </div>
          </div>

          {/* Gases section */}
          <div className="mb-3 border-t border-[rgba(255,255,255,0.08)] pt-3">
            <div className="mb-1.5 text-[11px] font-[510] uppercase tracking-[0.08em] text-[#8a8f98]">Газы</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md bg-[rgba(255,255,255,0.02)] p-2 text-center">
                <div className="text-[10px] text-[#62666d]">CO₂</div>
                <div className="text-sm font-[510] text-[#d0d6e0]">{co2.toFixed(0)}</div>
                <div className="text-[9px] text-[#62666d]">ppm</div>
              </div>
              <div className="rounded-md bg-[rgba(255,255,255,0.02)] p-2 text-center">
                <div className="text-[10px] text-[#62666d]">CO</div>
                <div className="text-sm font-[510] text-[#d0d6e0]">{co.toFixed(2)}</div>
                <div className="text-[9px] text-[#62666d]">ppm</div>
              </div>
              <div className="rounded-md bg-[rgba(255,255,255,0.02)] p-2 text-center">
                <div className="text-[10px] text-[#62666d]">CH₂O</div>
                <div className="text-sm font-[510] text-[#d0d6e0]">{ch2o.toFixed(2)}</div>
                <div className="text-[9px] text-[#62666d]">ppm</div>
              </div>
              <div className="rounded-md bg-[rgba(255,255,255,0.02)] p-2 text-center">
                <div className="text-[10px] text-[#62666d]">VOC</div>
                <div className="text-sm font-[510] text-[#d0d6e0]">{voc.toFixed(2)}</div>
                <div className="text-[9px] text-[#62666d]">ppm</div>
              </div>
              <div className="rounded-md bg-[rgba(255,255,255,0.02)] p-2 text-center">
                <div className="text-[10px] text-[#62666d]">O₃</div>
                <div className="text-sm font-[510] text-[#d0d6e0]">{o3.toFixed(1)}</div>
                <div className="text-[9px] text-[#62666d]">ppb</div>
              </div>
              <div className="rounded-md bg-[rgba(255,255,255,0.02)] p-2 text-center">
                <div className="text-[10px] text-[#62666d]">NO₂</div>
                <div className="text-sm font-[510] text-[#d0d6e0]">{no2.toFixed(1)}</div>
                <div className="text-[9px] text-[#62666d]">ppb</div>
              </div>
            </div>
          </div>

          {/* Environment section */}
          {(temp != null || hum != null) && (
            <div className="mb-3 border-t border-[rgba(255,255,255,0.08)] pt-3">
              <div className="mb-1.5 text-[11px] font-[510] uppercase tracking-[0.08em] text-[#8a8f98]">Среда</div>
              <div className="grid grid-cols-2 gap-2">
                {temp != null && (
                  <div className="rounded-md bg-[rgba(255,255,255,0.02)] p-2 text-center">
                    <div className="text-[10px] text-[#62666d]">Темп.</div>
                    <div className="text-sm font-[510] text-[#d0d6e0]">{Number(temp).toFixed(1)}°C</div>
                  </div>
                )}
                {hum != null && (
                  <div className="rounded-md bg-[rgba(255,255,255,0.02)] p-2 text-center">
                    <div className="text-[10px] text-[#62666d]">Влажность</div>
                    <div className="text-sm font-[510] text-[#d0d6e0]">{Number(hum).toFixed(0)}%</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-between border-t border-[rgba(255,255,255,0.08)] pt-2 text-[10px] text-[#62666d]">
            <span>{sensor.name || siteName}</span>
            <span>{ts ? formatLastUpdated(ts) : 'Live'}</span>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

export const SensorMarker = memo(SensorMarkerInner);
