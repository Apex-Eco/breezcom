'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Cookies from 'js-cookie';
import Navigation from '@/components/Navigation';
import { airQualityAPI, authAPI, weatherAPI, type AirQualityData } from '@/lib/api';
import { useSensorsOnMap } from '@/hooks/useSensorsOnMap';

const Globe = dynamic(
  () => import('react-globe.gl').then((mod) => {
    const GlobeComp = mod.default;
    const Wrapper = (props: any) => {
      const { innerRef, ...rest } = props;
      return <GlobeComp ref={innerRef} {...rest} />;
    };
    Wrapper.displayName = 'GlobeWrapper';
    return Wrapper;
  }),
  { ssr: false }
);

function getAqiColor(aqi: number) {
  if (aqi <= 50) return '#00e400';
  if (aqi <= 100) return '#ffff00';
  if (aqi <= 150) return '#ff7e00';
  if (aqi <= 200) return '#ff0000';
  if (aqi <= 300) return '#8f3f97';
  return '#7e0023';
}

export default function Map3DPage() {
  const [user, setUser] = useState<any>(null);
  const [airQualityPoints, setAirQualityPoints] = useState<any[]>([]);
  const globeRef = useRef<any>(null);
  const globeContainerRef = useRef<HTMLDivElement | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const { sensors, loading, error } = useSensorsOnMap({
    userId: user?.id ?? null,
    refetchIntervalMs: 60_000,
  });

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) return;

    authAPI.getMe().then(setUser).catch(() => Cookies.remove('token'));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadAirQuality = async () => {
      try {
        const data = await airQualityAPI.getAllAirQuality();
        if (cancelled) return;

        const nextPoints = (Array.isArray(data) ? data : [])
          .map((item: AirQualityData, index: number) => {
            const coords = item?.location?.coordinates;
            if (!coords || coords.length < 2) return null;
            const [lng, lat] = coords;
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

            const pollution = item.current?.pollution;
            const weather = item.current?.weather;
            const aqi = pollution?.aqius ?? 0;
            return {
              id: `aq-${item.city}-${item.state}-${index}`,
              lat,
              lng,
              aqi,
              city: item.sensor_data?.site || item.city || 'Air station',
              country: item.country || 'KZ',
              pm1: pollution?.pm1 ?? 0,
              pm25: pollution?.pm25 ?? aqi,
              pm10: pollution?.pm10 ?? 0,
              co2: pollution?.co2 ?? 0,
              co: pollution?.co ?? 0,
              voc: pollution?.voc ?? 0,
              o3: pollution?.o3 ?? 0,
              no2: pollution?.no2 ?? 0,
              ch2o: pollution?.ch2o ?? 0,
              temp: weather?.tp ?? 0,
              hum: weather?.hu ?? 0,
              color: getAqiColor(aqi),
              source: 'air-quality',
              timestamp: pollution?.ts ?? null,
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null);

        const pointsWithLiveWeather = await Promise.all(
          nextPoints.map(async (point) => {
            try {
              const weather = await weatherAPI.getCurrent(point.lat, point.lng);
              return {
                ...point,
                temp: Number.isFinite(weather?.temperature) ? weather.temperature : point.temp,
                hum: Number.isFinite(weather?.humidity) ? weather.humidity : point.hum,
              };
            } catch (weatherError) {
              console.warn('Failed to load weather for globe point', point.id, weatherError);
              return point;
            }
          })
        );

        if (cancelled) return;
        setAirQualityPoints(pointsWithLiveWeather);
      } catch (loadError) {
        console.warn('Failed to load air-quality points for globe', loadError);
      }
    };

    void loadAirQuality();
    const interval = window.setInterval(loadAirQuality, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const points = useMemo(
    () => {
      const sensorPoints = sensors
        .filter((sensor) => Number.isFinite(sensor.lat) && Number.isFinite(sensor.lng))
        .map((sensor) => {
          const params = sensor.parameters ?? {};
          return {
            id: sensor.id,
            lat: sensor.lat,
            lng: sensor.lng,
            aqi: sensor.aqi,
            city: sensor.name || sensor.site || sensor.city || 'Sensor',
            country: sensor.country || 'KZ',
            pm1: params.pm1 ?? 0,
            pm25: params.pm25 ?? sensor.aqi ?? 0,
            pm10: params.pm10 ?? 0,
            co2: params.co2 ?? 0,
            co: params.co ?? 0,
            voc: params.voc ?? 0,
            o3: params.o3 ?? 0,
            no2: params.no2 ?? 0,
            ch2o: params.ch2o ?? 0,
            temp: params.temp ?? 0,
            hum: params.hum ?? 0,
            color: getAqiColor(sensor.aqi),
            source: sensor.isPurchased ? 'purchased' : 'sensor',
            timestamp: sensor.timestamp ?? null,
          };
        });

      const mergedById = new Map<string, any>();
      airQualityPoints.forEach((point) => mergedById.set(point.id, point));
      sensorPoints.forEach((point) => mergedById.set(point.id, point));
      return Array.from(mergedById.values());
    },
    [airQualityPoints, sensors]
  );

  const globePoints = useMemo(() => {
    if (points.length > 0) {
      return points;
    }

    return [
      {
        id: 'fallback-almaty',
        lat: 43.238949,
        lng: 76.889709,
        aqi: 72,
        city: 'Almaty',
        country: 'KZ',
        pm1: 18,
        pm25: 28.4,
        pm10: 46,
        co2: 462,
        co: 0.7,
        voc: 0.31,
        o3: 19.4,
        no2: 28.1,
        ch2o: 0.02,
        temp: 21.5,
        hum: 46,
        color: getAqiColor(72),
        source: 'fallback',
        timestamp: new Date().toISOString(),
      },
    ];
  }, [points]);

  useEffect(() => {
    const node = globeContainerRef.current;
    if (!node) return;

    const updateViewport = () => {
      const nextWidth = Math.max(320, Math.floor(node.clientWidth));
      const nextHeight = Math.max(500, Math.floor(node.clientHeight));
      setViewport((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight }
      );
    };

    updateViewport();

    const observer = new ResizeObserver(updateViewport);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!globeRef.current) return;

    if (globePoints.length === 0) {
      globeRef.current.pointOfView({ lat: 43.222, lng: 76.8512, altitude: 2.1 }, 0);
      return;
    }

    const preferredPoint =
      globePoints.find((point) => point.source !== 'sensor' || point.id !== 'demo-tynysai-marker') ||
      globePoints[0];
    globeRef.current.pointOfView(
      { lat: preferredPoint.lat, lng: preferredPoint.lng, altitude: 2.0 },
      1200
    );
  }, [globePoints]);

  return (
    <main className="min-h-screen page-shell relative overflow-hidden">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#1a1a2e] to-[#0a0a0a]" />
      </div>

      <Navigation user={user} onLogout={() => { Cookies.remove('token'); setUser(null); }} />

      <div className="relative z-10 pt-24 pb-8">
        <div className="container mx-auto px-4">
          <div className="mb-6">
            <h1 className="text-4xl md:text-5xl font-black mb-2 wise-gradient-text">
              3D Map
            </h1>
            <p className="text-muted">
              Globe view using the same live sensor set as the dashboard map.
            </p>
          </div>

          <div className="glass-strong rounded-3xl border border-green-500/30 overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-r from-[#0f0f0f] via-[#151515] to-[#1a1a1a] px-6 py-4 border-b border-green-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                <span className="text-primary font-semibold">{globePoints.length} sensors on the globe</span>
              </div>
              <span className="text-muted text-xs">refresh every 60 sec</span>
            </div>

            <div
              ref={globeContainerRef}
              className="relative flex items-center justify-center"
              style={{ height: '75vh', minHeight: '500px' }}
            >
              {isClient && viewport.width > 0 && viewport.height > 0 ? (
                <Globe
                  innerRef={globeRef}
                  width={viewport.width}
                  height={viewport.height}
                  globeImageUrl="https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
                  backgroundImageUrl="https://unpkg.com/three-globe/example/img/night-sky.png"
                  pointsData={globePoints}
                  pointLat="lat"
                  pointLng="lng"
                  pointAltitude={(d: any) => Math.max(0.02, Math.min(0.4, (d.aqi || 0) / 500))}
                  pointColor="color"
                  pointRadius={0.35}
                  backgroundColor="rgba(0,0,0,0)"
                  showAtmosphere
                  atmosphereColor="#3b82f6"
                  atmosphereAltitude={0.18}
                  onPointHover={(point: any) => {
                    document.body.style.cursor = point ? 'pointer' : 'default';
                  }}
                  pointLabel={(d: any) => `
                    <div style="background:rgba(0,0,0,0.95);padding:16px;border-radius:12px;border:2px solid ${d.color};color:#fff;font-family:system-ui;min-width:300px;box-shadow:0 8px 32px rgba(0,0,0,0.6);">
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                        <div style="font-size:18px;font-weight:800;color:${d.color}">${d.city}</div>
                        <div style="background:${d.color};color:#000;font-weight:800;padding:4px 10px;border-radius:8px;font-size:16px;">${Math.round(d.aqi)}</div>
                      </div>
                      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;">
                        <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:8px;text-align:center;">
                          <div style="color:#888;font-size:10px;">PM1</div>
                          <div style="font-weight:700;font-size:16px;">${d.pm1?.toFixed(0) ?? 0}</div>
                          <div style="color:#666;font-size:9px;">µg/m³</div>
                        </div>
                        <div style="background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.2);border-radius:8px;padding:8px;text-align:center;">
                          <div style="color:#00ff88;font-size:10px;font-weight:600;">PM2.5</div>
                          <div style="font-weight:700;font-size:16px;">${d.pm25?.toFixed(1) ?? 0}</div>
                          <div style="color:#666;font-size:9px;">µg/m³</div>
                        </div>
                        <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:8px;text-align:center;">
                          <div style="color:#888;font-size:10px;">PM10</div>
                          <div style="font-weight:700;font-size:16px;">${d.pm10?.toFixed(0) ?? 0}</div>
                          <div style="color:#666;font-size:9px;">µg/m³</div>
                        </div>
                      </div>
                      <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:10px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:11px;">
                        <div><span style="color:#888;">CO2</span> <span style="font-weight:600;">${d.co2?.toFixed(0) ?? 0}</span> <span style="color:#666;font-size:9px;">ppm</span></div>
                        <div><span style="color:#888;">CO</span> <span style="font-weight:600;">${d.co?.toFixed(2) ?? 0}</span> <span style="color:#666;font-size:9px;">ppm</span></div>
                        <div><span style="color:#888;">CH2O</span> <span style="font-weight:600;">${d.ch2o?.toFixed(2) ?? 0}</span> <span style="color:#666;font-size:9px;">ppm</span></div>
                        <div><span style="color:#888;">VOC</span> <span style="font-weight:600;">${d.voc?.toFixed(2) ?? 0}</span> <span style="color:#666;font-size:9px;">ppm</span></div>
                        <div><span style="color:#888;">O3</span> <span style="font-weight:600;">${d.o3?.toFixed(1) ?? 0}</span> <span style="color:#666;font-size:9px;">ppb</span></div>
                        <div><span style="color:#888;">NO2</span> <span style="font-weight:600;">${d.no2?.toFixed(1) ?? 0}</span> <span style="color:#666;font-size:9px;">ppb</span></div>
                      </div>
                      <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:8px;margin-top:10px;display:flex;justify-content:space-around;font-size:12px;">
                        <div><span style="color:#f59e0b;">Temp</span> ${d.temp?.toFixed(1) ?? '—'}°C</div>
                        <div><span style="color:#3b82f6;">Humidity</span> ${d.hum?.toFixed(0) ?? '—'}%</div>
                      </div>
                    </div>
                  `}
                  enablePointerInteraction={true}
                  animateIn={true}
                  waitForGlobeReady={true}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-green-500/20 border-t-green-500 mx-auto mb-4" />
                    <div className="text-green-400 text-lg font-semibold">
                      {loading ? 'Loading globe data...' : 'Preparing globe...'}
                    </div>
                  </div>
                </div>
              )}
              {!loading && error ? (
                <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-theme bg-black/60 px-4 py-2 text-xs text-secondary backdrop-blur-md">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="bg-gradient-to-r from-[#0f0f0f] via-[#151515] to-[#1a1a1a] px-6 py-3 border-t border-green-500/30">
              <div className="flex flex-wrap items-center gap-4 justify-center text-xs text-muted">
                {[
                  { color: '#00e400', label: 'Good (0-50)' },
                  { color: '#ffff00', label: 'Moderate (51-100)' },
                  { color: '#ff7e00', label: 'Unhealthy (101-150)' },
                  { color: '#ff0000', label: 'Dangerous (151-200)' },
                  { color: '#8f3f97', label: 'Very dangerous (201+)' },
                ].map((item) => (
                  <div key={item.color} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
