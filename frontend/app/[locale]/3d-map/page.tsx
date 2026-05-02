'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Cookies from 'js-cookie';
import Navigation from '@/components/Navigation';
import { airQualityAPI, authAPI, weatherAPI, type AirQualityData } from '@/lib/api';
import { useSensorsOnMap, type MapSensor } from '@/hooks/useSensorsOnMap';

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

const SensorDetailPanel = dynamic(
  () => import('@/components/map/SensorDetailPanel').then((mod) => mod.SensorDetailPanel),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-48 items-center justify-center rounded-[30px] border border-theme bg-surface">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-theme border-t-green-400" />
      </div>
    ),
  }
);

const AQI_LEGEND = [
  { color: '#00e400', label: 'Good', range: '0-50' },
  { color: '#ffff00', label: 'Moderate', range: '51-100' },
  { color: '#ff7e00', label: 'Unhealthy', range: '101-150' },
  { color: '#ff0000', label: 'Dangerous', range: '151-200' },
  { color: '#8f3f97', label: 'Very dangerous', range: '201+' },
];

function getAqiColor(aqi: number) {
  if (aqi <= 50) return '#00e400';
  if (aqi <= 100) return '#ffff00';
  if (aqi <= 150) return '#ff7e00';
  if (aqi <= 200) return '#ff0000';
  if (aqi <= 300) return '#8f3f97';
  return '#7e0023';
}

function pointToMapSensor(point: any): MapSensor {
  return {
    id: String(point.id),
    lat: Number(point.lat),
    lng: Number(point.lng),
    aqi: Number(point.aqi ?? 0),
    isPurchased: point.source === 'purchased' || Boolean(point.isPurchased),
    isDemo: point.source === 'fallback',
    name: point.name || point.city || point.site || 'Air station',
    site: point.site,
    city: point.city,
    state: point.state,
    country: point.country,
    device_id: point.device_id,
    device_name: point.device_name,
    label: point.label,
    description: point.description,
    timestamp: point.timestamp ?? undefined,
    parameters: point.parameters ?? {
      pm1: point.pm1 ?? 0,
      pm25: point.pm25 ?? point.aqi ?? 0,
      pm10: point.pm10 ?? 0,
      co2: point.co2 ?? 0,
      co: point.co ?? 0,
      voc: point.voc ?? 0,
      o3: point.o3 ?? 0,
      no2: point.no2 ?? 0,
      ch2o: point.ch2o ?? 0,
      temp: point.temp ?? 0,
      hum: point.hum ?? 0,
    },
    airQualityData: point.airQualityData,
  };
}

function GlobeSidebar({
  selectedSensor,
  onClearSelection,
}: {
  selectedSensor: MapSensor | null;
  onClearSelection: () => void;
}) {
  if (!selectedSensor) return null;

  return (
    <aside className="hidden h-full min-w-0 border-r border-theme bg-surface lg:flex lg:w-[390px] lg:flex-col xl:w-[420px]">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-theme px-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-primary">Station details</p>
          <p className="truncate text-xs text-muted">{selectedSensor.name || selectedSensor.site || 'Air station'}</p>
        </div>
        <button type="button" onClick={onClearSelection} className="wise-btn-secondary h-9 px-3 text-xs">
          Close
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <SensorDetailPanel sensor={selectedSensor} />
      </div>
    </aside>
  );
}

export default function Map3DPage() {
  const [user, setUser] = useState<any>(null);
  const [airQualityPoints, setAirQualityPoints] = useState<any[]>([]);
  const [selectedSensor, setSelectedSensor] = useState<MapSensor | null>(null);
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
              name: item.sensor_data?.site || item.city || 'Air station',
              city: item.city,
              state: item.state,
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
              airQualityData: item,
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

  const points = useMemo(() => {
    const sensorPoints = sensors
      .filter((sensor) => Number.isFinite(sensor.lat) && Number.isFinite(sensor.lng))
      .map((sensor) => {
        const params = sensor.parameters ?? {};
        return {
          ...sensor,
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
  }, [airQualityPoints, sensors]);

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
        name: 'Almaty',
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
      const nextHeight = Math.max(420, Math.floor(node.clientHeight));
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
  }, [selectedSensor]);

  useEffect(() => {
    if (!globeRef.current) return;

    const preferredPoint = selectedSensor
      ? globePoints.find((point) => String(point.id) === selectedSensor.id)
      : globePoints.find((point) => point.source !== 'sensor' || point.id !== 'demo-tynysai-marker') || globePoints[0];

    if (!preferredPoint) return;

    globeRef.current.pointOfView(
      { lat: preferredPoint.lat, lng: preferredPoint.lng, altitude: selectedSensor ? 1.45 : 2.0 },
      1000
    );
  }, [globePoints, selectedSensor]);

  const closeSelectedSensor = () => setSelectedSensor(null);

  return (
    <main className="flex min-h-screen flex-col overflow-hidden page-shell">
      <Navigation user={user} onLogout={() => { Cookies.remove('token'); setUser(null); }} />

      <div className={`grid h-[calc(100dvh-4rem)] min-h-[520px] grid-cols-1 overflow-hidden border-t border-theme ${
        selectedSensor ? 'lg:grid-cols-[390px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)]' : ''
      }`}>
        <GlobeSidebar selectedSensor={selectedSensor} onClearSelection={closeSelectedSensor} />

        <section ref={globeContainerRef} className="relative min-h-0 min-w-0 overflow-hidden bg-[#05090f]">
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
              atmosphereColor="#9fe870"
              atmosphereAltitude={0.14}
              onPointClick={(point: any) => setSelectedSensor(pointToMapSensor(point))}
              onPointHover={(point: any) => {
                document.body.style.cursor = point ? 'pointer' : 'default';
              }}
              pointLabel={(d: any) => `
                <div style="background:rgba(0,0,0,0.9);padding:10px 12px;border-radius:12px;border:1px solid ${d.color};color:#fff;font-family:system-ui;min-width:180px;">
                  <div style="font-weight:800;color:${d.color};margin-bottom:4px;">${d.name || d.city}</div>
                  <div style="font-size:12px;">AQI ${Math.round(d.aqi)}</div>
                </div>
              `}
              enablePointerInteraction={true}
              animateIn={true}
              waitForGlobeReady={true}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-4 border-green-500/20 border-t-green-500" />
                <div className="text-lg font-semibold text-green-400">
                  {loading ? 'Loading globe data...' : 'Preparing globe...'}
                </div>
              </div>
            </div>
          )}

          {!selectedSensor ? (
            <div className="pointer-events-none absolute left-3 top-3 z-[650] max-w-[min(21rem,calc(100%-1.5rem))] rounded-2xl border border-theme bg-surface/95 p-4 shadow-xl backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#9fe870] text-lg font-black text-[#163300]">3D</div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-primary">Breez Air Quality</p>
                  <p className="mt-1 text-xs text-secondary">{globePoints.length} stations. Select a point on the globe.</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {AQI_LEGEND.slice(0, 4).map((item) => (
                  <div key={item.label} className="flex min-w-0 items-center gap-2 text-[11px] font-bold text-muted">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="truncate">{item.range}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {!loading && error ? (
            <div className="pointer-events-none absolute bottom-14 left-1/2 z-[650] -translate-x-1/2 rounded-full border border-theme bg-black/60 px-4 py-2 text-xs text-secondary backdrop-blur-md">
              {error}
            </div>
          ) : null}

          <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[600]">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              {AQI_LEGEND.map((item) => (
                <div
                  key={item.color}
                  className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-primary sm:text-[11px]"
                  style={{ backgroundColor: item.color }}
                >
                  {item.label} ({item.range})
                </div>
              ))}
            </div>
          </div>

          {selectedSensor ? (
            <div className="absolute inset-x-0 bottom-0 z-[760] max-h-[78%] rounded-t-[28px] border border-theme bg-surface shadow-2xl lg:hidden">
              <div className="flex h-12 items-center justify-between border-b border-theme px-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-primary">{selectedSensor.name || selectedSensor.site || 'Air station'}</p>
                </div>
                <button type="button" onClick={closeSelectedSensor} className="wise-btn-secondary h-8 px-3 text-xs">
                  Close
                </button>
              </div>
              <div className="max-h-[calc(78dvh-3rem)] overflow-y-auto p-3">
                <SensorDetailPanel sensor={selectedSensor} />
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
