'use client';

import type { MapSensor } from '@/hooks/useSensorsOnMap';
import { getAqiCategory } from '@/lib/map-aqi';

interface SensorDetailPanelProps {
  sensor: MapSensor;
}

function ParamCard({ label, value, unit, accent }: { label: string; value: string; unit: string; accent?: boolean }) {
  return (
    <div className={`rounded-md border p-3 text-center ${accent ? 'bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.08)]' : 'bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.08)]'}`}>
      <div className="mb-1 text-[10px] uppercase tracking-[0.08em] text-[#62666d]">{label}</div>
      <div className="text-xl font-[590] leading-tight text-[#f7f8f8]">{value}</div>
      <div className="text-[10px] text-[#62666d]">{unit}</div>
    </div>
  );
}

function getTimeAgo(ts?: string): { text: string; isOnline: boolean } {
  if (!ts) return { text: 'нет данных', isOnline: false };
  try {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 2) return { text: 'только что', isOnline: true };
    if (mins < 60) return { text: `${mins} мин назад`, isOnline: mins < 15 };
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return { text: `${hrs} ч назад`, isOnline: false };
    const days = Math.floor(hrs / 24);
    return { text: `${days} дн назад`, isOnline: false };
  } catch {
    return { text: 'нет данных', isOnline: false };
  }
}

export function SensorDetailPanel({ sensor }: SensorDetailPanelProps) {
  const params = sensor.parameters ?? {};
  const aqi = sensor.aqi;
  const category = getAqiCategory(aqi);
  const { text: timeAgo, isOnline } = getTimeAgo(sensor.timestamp);

  const pm1  = params.pm1  ?? 0;
  const pm25 = params.pm25 ?? 0;
  const pm10 = params.pm10 ?? 0;
  const co2  = params.co2  ?? 0;
  const co   = params.co   ?? 0;
  const no2  = params.no2  ?? 0;
  const o3   = params.o3   ?? 0;
  const voc  = params.voc  ?? 0;
  const ch2o = params.ch2o ?? 0;
  const temp = params.temp ?? null;
  const hum  = params.hum  ?? null;

  // [restyle]
  return (
    <div
      className="overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0f1011]"
      style={{
        boxShadow:
          'rgba(0,0,0,0.2) 0px 0px 0px 1px, rgba(0,0,0,0.4) 0px 2px 4px',
        fontFeatureSettings: '"cv01", "ss03"',
      }}
    >
      {/* Header */}
      <div className="border-b border-[rgba(255,255,255,0.08)] bg-[#0f1011] px-5 py-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="truncate text-lg font-[590] tracking-[-0.24px] text-[#f7f8f8]">{sensor.name || 'Sensor'}</h3>
          <div className="flex items-center gap-1.5">
            {isOnline ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10b981]" />
                </span>
                <span className="text-[10px] font-[510] uppercase tracking-[0.08em] text-[#d0d6e0]">Online</span>
              </>
            ) : (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#62666d]" />
                </span>
                <span className="text-[10px] font-[510] uppercase tracking-[0.08em] text-[#8a8f98]">Offline</span>
              </>
            )}
          </div>
        </div>
        <p className="text-xs text-[#8a8f98]">
          {sensor.city ?? ''}{sensor.country ? `, ${sensor.country}` : ''}
          <span className="ml-2 text-[#62666d]">· {timeAgo}</span>
        </p>
      </div>

      <div className="p-5 space-y-5">
        {/* AQI */}
        <div
          className="rounded-lg border border-[rgba(255,255,255,0.08)] p-4 text-center"
          style={{ backgroundColor: category.color, color: category.textColor }}
        >
          <div className="mb-1 text-5xl font-[590] leading-none">{aqi}</div>
          <div className="text-sm font-[510]" style={{ opacity: 0.85 }}>{category.label}</div>
          <div className="text-xs mt-0.5" style={{ opacity: 0.6 }}>AQI (US EPA)</div>
        </div>

        {/* Particles */}
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-[510] uppercase tracking-[0.08em] text-[#8a8f98]">
            <span className="h-px flex-1 bg-[rgba(255,255,255,0.08)]" />
            Частицы
            <span className="h-px flex-1 bg-[rgba(255,255,255,0.08)]" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <ParamCard label="PM1" value={pm1.toFixed(0)} unit="µg/m³" />
            <ParamCard label="PM2.5" value={pm25.toFixed(1)} unit="µg/m³" accent />
            <ParamCard label="PM10" value={pm10.toFixed(0)} unit="µg/m³" />
          </div>
        </div>

        {/* Gases */}
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-[510] uppercase tracking-[0.08em] text-[#8a8f98]">
            <span className="h-px flex-1 bg-[rgba(255,255,255,0.08)]" />
            Газы
            <span className="h-px flex-1 bg-[rgba(255,255,255,0.08)]" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <ParamCard label="CO₂" value={co2.toFixed(0)} unit="ppm" />
            <ParamCard label="CO" value={co.toFixed(2)} unit="ppm" />
            <ParamCard label="CH₂O" value={ch2o.toFixed(2)} unit="ppm" />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <ParamCard label="VOC" value={voc.toFixed(2)} unit="ppm" />
            <ParamCard label="O₃" value={o3.toFixed(1)} unit="ppb" />
            <ParamCard label="NO₂" value={no2.toFixed(1)} unit="ppb" />
          </div>
        </div>

        {/* Environment */}
        {(temp != null || hum != null) && (
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-[510] uppercase tracking-[0.08em] text-[#8a8f98]">
              <span className="h-px flex-1 bg-[rgba(255,255,255,0.08)]" />
              Среда
              <span className="h-px flex-1 bg-[rgba(255,255,255,0.08)]" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {temp != null && (
                <div className="rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-3 text-center">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.08em] text-[#62666d]">Температура</div>
                  <div className="text-2xl font-[590] text-[#f7f8f8]">{Number(temp).toFixed(1)}<span className="text-sm text-[#8a8f98]">°C</span></div>
                </div>
              )}
              {hum != null && (
                <div className="rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-3 text-center">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.08em] text-[#62666d]">Влажность</div>
                  <div className="text-2xl font-[590] text-[#f7f8f8]">{Number(hum).toFixed(0)}<span className="text-sm text-[#8a8f98]">%</span></div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-[rgba(255,255,255,0.08)] pt-2 text-center text-[10px] text-[#62666d]">
          {isOnline ? 'Обновляется каждые 60 секунд' : `Последние данные: ${timeAgo}`}
        </div>
      </div>
    </div>
  );
}
