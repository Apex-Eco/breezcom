'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MapSensor } from '@/hooks/useSensorsOnMap';
import { mlAPI, weatherAPI, type MlPredictionResult, type WeatherSnapshot } from '@/lib/api';
import { getAqiCategory } from '@/lib/map-aqi';

interface SensorDetailPanelProps {
  sensor: MapSensor;
}

type LoadState<T> = {
  loading: boolean;
  data: T | null;
  error: string | null;
};

const emptyWeather: LoadState<WeatherSnapshot> = { loading: false, data: null, error: null };
const emptyPrediction: LoadState<MlPredictionResult> = { loading: false, data: null, error: null };

function toNumber(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getTimeAgo(ts?: string): { text: string; isOnline: boolean } {
  if (!ts) return { text: 'No recent data', isOnline: false };
  try {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 2) return { text: 'Just now', isOnline: true };
    if (mins < 60) return { text: `${mins} min ago`, isOnline: mins < 15 };
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return { text: `${hrs} hr ago`, isOnline: false };
    const days = Math.floor(hrs / 24);
    return { text: `${days} days ago`, isOnline: false };
  } catch {
    return { text: 'No recent data', isOnline: false };
  }
}

function categoryForLabel(label: string) {
  if (label === 'Good') return { color: '#00e400', textColor: '#000000' };
  if (label === 'Moderate') return { color: '#ffff00', textColor: '#000000' };
  if (label === 'Unhealthy for Sensitive Groups') return { color: '#ff7e00', textColor: '#000000' };
  if (label === 'Unhealthy') return { color: '#ff0000', textColor: '#ffffff' };
  if (label === 'Very Unhealthy') return { color: '#8f3f97', textColor: '#ffffff' };
  return { color: '#7e0023', textColor: '#ffffff' };
}

function buildHistory(aqi: number, timestamp?: string) {
  const baseTime = timestamp ? new Date(timestamp).getTime() : Date.now();
  return Array.from({ length: 24 }, (_, index) => {
    const hourOffset = 23 - index;
    const wave = Math.sin(index / 2.6) * 7;
    const drift = (index % 5) - 2;
    const value = Math.max(0, Math.round(aqi + wave + drift));
    return {
      time: new Date(baseTime - hourOffset * 60 * 60 * 1000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      aqi: value,
    };
  });
}

function MetricCard({
  label,
  value,
  unit,
  accent = false,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-[18px] border p-3 ${accent ? 'border-green-500/40 bg-green-500/10' : 'border-theme bg-white/5'}`}>
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">{label}</div>
      <div className="mt-1 text-xl font-black leading-none text-primary">
        {value}
        {unit ? <span className="ml-1 text-xs font-semibold text-muted">{unit}</span> : null}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.08em] text-muted">
      <span className="h-px flex-1 bg-[var(--border)]" />
      {children}
      <span className="h-px flex-1 bg-[var(--border)]" />
    </div>
  );
}

function buildPredictionPayload(sensor: MapSensor, weather: WeatherSnapshot | null) {
  const params = sensor.parameters ?? {};
  return {
    pm1: toNumber(params.pm1),
    pm25: toNumber(params.pm25, sensor.aqi),
    pm10: toNumber(params.pm10),
    co2: toNumber(params.co2),
    voc: toNumber(params.voc),
    ch2o: toNumber(params.ch2o),
    co: toNumber(params.co),
    o3: toNumber(params.o3),
    no2: toNumber(params.no2),
    temp: weather?.temperature ?? toNumber(params.temp),
    humidity: weather?.humidity ?? toNumber(params.hum),
    wind_speed: weather?.wind_speed ?? toNumber(params.wind_speed ?? params.ws),
    pressure: weather?.pressure ?? toNumber(params.pressure ?? params.pr, 1013),
  };
}

export function SensorDetailPanel({ sensor }: SensorDetailPanelProps) {
  const params = sensor.parameters ?? {};
  const aqi = sensor.aqi;
  const category = getAqiCategory(aqi);
  const { text: timeAgo, isOnline } = getTimeAgo(sensor.timestamp);
  const [weather, setWeather] = useState<LoadState<WeatherSnapshot>>(emptyWeather);
  const [prediction, setPrediction] = useState<LoadState<MlPredictionResult>>(emptyPrediction);

  const pm1 = toNumber(params.pm1);
  const pm25 = toNumber(params.pm25, aqi);
  const pm10 = toNumber(params.pm10);
  const co2 = toNumber(params.co2);
  const co = toNumber(params.co);
  const no2 = toNumber(params.no2);
  const o3 = toNumber(params.o3);
  const voc = toNumber(params.voc);
  const ch2o = toNumber(params.ch2o);
  const fallbackTemp = toNumber(params.temp);
  const fallbackHumidity = toNumber(params.hum);
  const fallbackWind = toNumber(params.wind_speed ?? params.ws);
  const fallbackPressure = toNumber(params.pressure ?? params.pr, 1013);
  const history = useMemo(() => buildHistory(aqi, sensor.timestamp), [aqi, sensor.timestamp]);

  useEffect(() => {
    let cancelled = false;

    async function loadPanelData() {
      setWeather({ loading: true, data: null, error: null });
      setPrediction({ loading: true, data: null, error: null });

      let weatherSnapshot: WeatherSnapshot | null = null;
      try {
        weatherSnapshot = await weatherAPI.getCurrent(sensor.lat, sensor.lng);
        if (!cancelled) {
          setWeather({ loading: false, data: weatherSnapshot, error: null });
        }
      } catch (error: any) {
        if (!cancelled) {
          setWeather({
            loading: false,
            data: null,
            error: error?.response?.data?.detail || error?.message || 'Weather unavailable',
          });
        }
      }

      try {
        const result = await mlAPI.predict(buildPredictionPayload(sensor, weatherSnapshot));
        if (!cancelled) {
          setPrediction({ loading: false, data: result, error: null });
        }
      } catch (error: any) {
        if (!cancelled) {
          setPrediction({
            loading: false,
            data: null,
            error: error?.response?.data?.detail || error?.message || 'Prediction unavailable',
          });
        }
      }
    }

    void loadPanelData();

    return () => {
      cancelled = true;
    };
  }, [sensor]);

  const weatherData = weather.data;
  const temperature = weatherData?.temperature ?? fallbackTemp;
  const humidity = weatherData?.humidity ?? fallbackHumidity;
  const wind = weatherData?.wind_speed ?? fallbackWind;
  const pressure = weatherData?.pressure ?? fallbackPressure;
  const predictedCategory = prediction.data ? categoryForLabel(prediction.data.danger_level) : null;
  const sourceItems = [
    sensor.device_name || sensor.name,
    sensor.device_id,
    sensor.site || sensor.label,
    sensor.isDemo ? 'Demo station' : null,
    sensor.isPurchased ? 'Purchased sensor' : 'Live map station',
  ].filter(Boolean);

  return (
    <div className="max-h-full overflow-y-auto rounded-[30px] border border-theme bg-surface text-primary shadow-[var(--ring-shadow)]">
      <div className="border-b border-theme bg-green-500/10 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="truncate text-xl font-black leading-tight text-primary">
              {sensor.name || sensor.site || 'Air station'}
            </h3>
            <p className="mt-1 text-xs font-semibold text-muted">
              {[sensor.city, sensor.state, sensor.country].filter(Boolean).join(', ') || 'Almaty'}
              <span className="ml-2">lat {sensor.lat.toFixed(4)}, lon {sensor.lng.toFixed(4)}</span>
            </p>
          </div>
          <div className="shrink-0 rounded-full border border-theme bg-surface px-3 py-1 text-xs font-bold">
            <span className={`mr-1 inline-block h-2 w-2 rounded-full ${isOnline ? 'bg-[#10b981]' : 'bg-[#868685]'}`} />
            {isOnline ? 'Online' : 'Offline'}
          </div>
        </div>
        <div className="mt-3 text-xs text-muted">{timeAgo}</div>
      </div>

      <div className="space-y-5 p-5">
        <section
          className="rounded-[26px] border border-theme p-5"
          style={{ backgroundColor: category.color, color: category.textColor }}
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.08em] opacity-75">Current AQI</div>
              <div className="mt-1 text-6xl font-black leading-none">{aqi}</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-black leading-tight">{category.label}</div>
              <div className="mt-1 text-xs font-bold opacity-75">US EPA scale</div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <SectionTitle>Main Pollutants</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            <MetricCard label="PM1" value={pm1.toFixed(0)} unit="ug/m3" />
            <MetricCard label="PM2.5" value={pm25.toFixed(1)} unit="ug/m3" accent />
            <MetricCard label="PM10" value={pm10.toFixed(0)} unit="ug/m3" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <MetricCard label="CO2" value={co2.toFixed(0)} unit="ppm" />
            <MetricCard label="VOC" value={voc.toFixed(2)} unit="ppm" />
            <MetricCard label="NO2" value={no2.toFixed(1)} unit="ppb" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <MetricCard label="CO" value={co.toFixed(2)} unit="ppm" />
            <MetricCard label="O3" value={o3.toFixed(1)} unit="ppb" />
            <MetricCard label="CH2O" value={ch2o.toFixed(2)} unit="ppm" />
          </div>
        </section>

        <section className="space-y-3">
          <SectionTitle>Weather</SectionTitle>
          {weather.loading ? <div className="rounded-[18px] border border-theme bg-white/5 p-3 text-sm text-muted">Loading weather...</div> : null}
          {weather.error ? <div className="rounded-[18px] border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-muted">Weather fallback: {weather.error}</div> : null}
          <div className="grid grid-cols-2 gap-2">
            <MetricCard label="Temp" value={temperature.toFixed(1)} unit="C" />
            <MetricCard label="Humidity" value={humidity.toFixed(0)} unit="%" />
            <MetricCard label="Wind" value={wind.toFixed(1)} unit="km/h" />
            <MetricCard label="Pressure" value={pressure.toFixed(0)} unit="hPa" />
          </div>
          <div className="rounded-[18px] border border-theme bg-white/5 p-3 text-xs text-muted">
            {weatherData?.condition || 'Condition unavailable'}
            {weatherData?.provider ? <span className="ml-2">Source: {weatherData.provider}</span> : null}
          </div>
        </section>

        <section className="space-y-3">
          <SectionTitle>24 Hour AQI</SectionTitle>
          <div className="h-40 rounded-[22px] border border-theme bg-white/5 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 8, right: 6, left: -28, bottom: 0 }}>
                <defs>
                  <linearGradient id={`aqiGradient-${sensor.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9fe870" stopOpacity={0.75} />
                    <stop offset="95%" stopColor="#9fe870" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} interval={5} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} width={34} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 18,
                    color: 'var(--text-primary)',
                  }}
                />
                <Area type="monotone" dataKey="aqi" stroke="#9fe870" strokeWidth={3} fill={`url(#aqiGradient-${sensor.id})`} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-muted">Fallback trend generated from the current AQI when live history is unavailable.</p>
        </section>

        <section className="space-y-3">
          <SectionTitle>Prediction</SectionTitle>
          {prediction.loading ? <div className="rounded-[18px] border border-theme bg-white/5 p-3 text-sm text-muted">Running smog prediction...</div> : null}
          {prediction.error ? <div className="rounded-[18px] border border-red-500/30 bg-red-500/10 p-3 text-sm text-muted">Prediction unavailable: {prediction.error}</div> : null}
          {prediction.data && predictedCategory ? (
            <div className="space-y-3 rounded-[24px] border border-theme bg-white/5 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.08em] text-muted">Predicted AQI</div>
                  <div className="mt-1 text-4xl font-black text-primary">{prediction.data.predicted_aqi}</div>
                </div>
                <div
                  className="rounded-full px-3 py-1 text-xs font-black"
                  style={{ backgroundColor: predictedCategory.color, color: predictedCategory.textColor }}
                >
                  {prediction.data.danger_level}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <MetricCard label="Main pollutant" value={prediction.data.main_pollutant} />
                <MetricCard
                  label="Model"
                  value={prediction.data.model_used === 'almaty_smog_model.pkl' ? 'ML' : 'Fallback'}
                />
              </div>
              <div className="rounded-[18px] border border-green-500/30 bg-green-500/10 p-3 text-sm font-semibold text-secondary">
                {prediction.data.recommendation}
              </div>
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <SectionTitle>Source</SectionTitle>
          <div className="rounded-[18px] border border-theme bg-white/5 p-3 text-sm text-secondary">
            {sourceItems.length > 0 ? sourceItems.join(' / ') : 'Source metadata unavailable'}
          </div>
        </section>
      </div>
    </div>
  );
}
