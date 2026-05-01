'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapSensor } from '@/hooks/useSensorsOnMap';
import type { MapStyleValue } from './types';
import { Link, usePathname } from '@/i18n/navigation';

if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  });
}

const ALMATY_CENTER: [number, number] = [43.2565, 76.9285];

const IQAIR_LEGEND = [
  { label: 'Good', color: '#22c55e' },
  { label: 'Moderate', color: '#eab308' },
  { label: 'Unhealthy for sensitive groups', color: '#f97316' },
  { label: 'Unhealthy', color: '#ef4444' },
  { label: 'Very unhealthy', color: '#8b5cf6' },
  { label: 'Hazardous', color: '#7f1d1d' },
];

const FIRE_LOCATIONS: Array<{ name: string; lat: number; lng: number }> = [
  { name: 'Alatau Industrial Zone', lat: 43.281, lng: 76.78 },
  { name: 'Aksai Industrial Cluster', lat: 43.247, lng: 76.793 },
  { name: 'Turksib Rail Yard', lat: 43.343, lng: 76.971 },
  { name: 'Sairan Heat Spot', lat: 43.219, lng: 76.84 },
];

type LatestSensor = {
  id: string;
  lat: number;
  lng: number;
  pm25: number;
  timestamp: string;
  site?: string | null;
};

type VelocityRecord = {
  header: {
    parameterCategory: number;
    parameterNumber: number;
    nx: number;
    ny: number;
    lo1: number;
    la1: number;
    lo2: number;
    la2: number;
    dx: number;
    dy: number;
    refTime: string;
    forecastTime: number;
    parameterUnit: string;
  };
  data: number[];
};

type LeafletWithPlugins = typeof L & {
  heatLayer?: (
    latlngs: Array<[number, number, number]>,
    options?: Record<string, unknown>
  ) => L.Layer;
  velocityLayer?: (options: Record<string, unknown>) => L.Layer;
};

const TILE_LAYERS: Record<
  MapStyleValue,
  { url: string; attribution: string; className?: string }
> = {
  standard: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    className: 'dark-map-tiles',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
  },
};

const pluginScriptLoadCache = new Map<string, Promise<void>>();

function loadPluginScript(pluginKey: string, sourceUrl: string): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  const cacheKey = `${pluginKey}:${sourceUrl}`;
  const cachedPromise = pluginScriptLoadCache.get(cacheKey);
  if (cachedPromise) {
    return cachedPromise;
  }

  const promise = new Promise<void>((resolve, reject) => {
    const selector = `script[data-leaflet-plugin="${pluginKey}"][src="${sourceUrl}"]`;
    const existingScript = document.querySelector<HTMLScriptElement>(selector);

    if (existingScript?.dataset.loaded === 'true') {
      resolve();
      return;
    }

    const script = existingScript ?? document.createElement('script');
    script.dataset.leafletPlugin = pluginKey;
    script.src = sourceUrl;
    script.async = true;

    const cleanup = () => {
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
    };

    const onLoad = () => {
      script.dataset.loaded = 'true';
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      pluginScriptLoadCache.delete(cacheKey);
      if (!existingScript) {
        script.remove();
      }
      reject(new Error(`Failed to load ${pluginKey} plugin script`));
    };

    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);

    if (!existingScript) {
      document.head.appendChild(script);
    }
  });

  pluginScriptLoadCache.set(cacheKey, promise);
  return promise;
}

function pm25ToAqi(pm25: number): number {
  const c = Math.max(0, pm25);
  const bands = [
    { cLow: 0, cHigh: 12, iLow: 0, iHigh: 50 },
    { cLow: 12.1, cHigh: 35.4, iLow: 51, iHigh: 100 },
    { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
    { cLow: 55.5, cHigh: 150.4, iLow: 151, iHigh: 200 },
    { cLow: 150.5, cHigh: 250.4, iLow: 201, iHigh: 300 },
    { cLow: 250.5, cHigh: 350.4, iLow: 301, iHigh: 400 },
    { cLow: 350.5, cHigh: 500.4, iLow: 401, iHigh: 500 },
  ];

  const band = bands.find((item) => c >= item.cLow && c <= item.cHigh) ?? bands[bands.length - 1];
  const aqi =
    ((band.iHigh - band.iLow) / (band.cHigh - band.cLow)) *
      (Math.min(c, band.cHigh) - band.cLow) +
    band.iLow;
  return Math.round(Math.max(0, Math.min(500, aqi)));
}

function normalizeAqi(aqi: number): number {
  return Math.max(0, Math.min(1, aqi / 500));
}

function buildVelocityField(baseU: number, baseV: number, refTime: string): VelocityRecord[] {
  const nx = 20;
  const ny = 20;
  const lo1 = 76.45;
  const lo2 = 77.25;
  const la1 = 43.65;
  const la2 = 42.95;
  const dx = (lo2 - lo1) / (nx - 1);
  const dy = (la1 - la2) / (ny - 1);

  const uData: number[] = [];
  const vData: number[] = [];

  for (let y = 0; y < ny; y += 1) {
    for (let x = 0; x < nx; x += 1) {
      const xNorm = x / (nx - 1);
      const yNorm = y / (ny - 1);
      const variationU = Math.sin(xNorm * Math.PI * 2) * 0.6 + Math.cos(yNorm * Math.PI) * 0.3;
      const variationV = Math.cos(xNorm * Math.PI * 2) * 0.5 + Math.sin(yNorm * Math.PI) * 0.35;
      uData.push(baseU + variationU);
      vData.push(baseV + variationV);
    }
  }

  return [
    {
      header: {
        parameterCategory: 2,
        parameterNumber: 2,
        nx,
        ny,
        lo1,
        la1,
        lo2,
        la2,
        dx,
        dy,
        refTime,
        forecastTime: 0,
        parameterUnit: 'm/s',
      },
      data: uData,
    },
    {
      header: {
        parameterCategory: 2,
        parameterNumber: 3,
        nx,
        ny,
        lo1,
        la1,
        lo2,
        la2,
        dx,
        dy,
        refTime,
        forecastTime: 0,
        parameterUnit: 'm/s',
      },
      data: vData,
    },
  ];
}

async function fetchWindField(signal?: AbortSignal): Promise<VelocityRecord[]> {
  const params = new URLSearchParams({
    latitude: '43.25',
    longitude: '76.93',
    hourly: 'wind_u_component_10m,wind_v_component_10m',
    timezone: 'Asia/Almaty',
    forecast_days: '1',
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
    signal,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const uSeries = Array.isArray(payload?.hourly?.wind_u_component_10m)
    ? payload.hourly.wind_u_component_10m
    : [];
  const vSeries = Array.isArray(payload?.hourly?.wind_v_component_10m)
    ? payload.hourly.wind_v_component_10m
    : [];
  const timeSeries = Array.isArray(payload?.hourly?.time) ? payload.hourly.time : [];

  const bestIndex = Math.max(
    0,
    uSeries.findIndex((item: unknown, index: number) => {
      const u = Number(item);
      const v = Number(vSeries[index]);
      return Number.isFinite(u) && Number.isFinite(v);
    })
  );

  const baseU = Number(uSeries[bestIndex] ?? 0);
  const baseV = Number(vSeries[bestIndex] ?? 0);
  const refTime =
    typeof timeSeries[bestIndex] === 'string'
      ? new Date(timeSeries[bestIndex]).toISOString()
      : new Date().toISOString();

  return buildVelocityField(baseU, baseV, refTime);
}

function FitToSensors({ sensors }: { sensors: MapSensor[] }) {
  const map = useMap();
  const hasFitted = useRef(false);

  useEffect(() => {
    if (hasFitted.current) return;
    if (!sensors.length) return;

    hasFitted.current = true;
    const points: [number, number][] = sensors.map((s) => [s.lat, s.lng]);
    if (points.length === 1) {
      map.setView(points[0], 13);
    } else {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [20, 20], maxZoom: 13 });
    }
  }, [map, sensors]);

  return null;
}

function ResizeOnFullscreen({ fullscreen }: { fullscreen: boolean }) {
  const map = useMap();

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [fullscreen, map]);

  return null;
}

function HeatMapLayer({
  visible,
  points,
}: {
  visible: boolean;
  points: Array<[number, number, number]>;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || !visible || points.length === 0) return;

    const leaflet = L as LeafletWithPlugins;
    if (!leaflet.heatLayer) return;

    const heatLayer = leaflet.heatLayer(points, {
      radius: 28,
      blur: 22,
      maxZoom: 16,
      minOpacity: 0.35,
      gradient: {
        0.0: 'green',
        0.33: 'yellow',
        0.66: 'orange',
        1.0: 'red',
      },
    });

    map.addLayer(heatLayer);
    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points, visible]);

  return null;
}

function WindLayer({
  visible,
  data,
}: {
  visible: boolean;
  data: VelocityRecord[] | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || !visible || !data) return;

    const leaflet = L as LeafletWithPlugins;
    if (!leaflet.velocityLayer) return;

    const windLayer = leaflet.velocityLayer({
      data,
      displayValues: false,
      maxVelocity: 20,
      minVelocity: 0,
      velocityScale: 0.0075,
      particleAge: 90,
      particleMultiplier: 0.007,
      lineWidth: 2,
      frameRate: 20,
      colorScale: ['#ffffff', '#e2e8f0', '#cbd5e1'],
    });

    map.addLayer(windLayer);
    return () => {
      map.removeLayer(windLayer);
    };
  }, [map, visible, data]);

  return null;
}

function FireLayer({ visible }: { visible: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !visible) return;

    const fireIcon = L.divIcon({
      className: 'fire-hotspot-icon',
      html: '<div style="font-size:18px;line-height:18px;filter:drop-shadow(0 0 4px rgba(251,146,60,.9));">🔥</div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      popupAnchor: [0, -8],
    });

    const layer = L.layerGroup();

    FIRE_LOCATIONS.forEach((fire) => {
      const marker = L.marker([fire.lat, fire.lng], { icon: fireIcon });
      marker.bindPopup(
        `<div class="space-y-1 text-sm"><div class="font-semibold">${fire.name}</div><div class="text-xs text-slate-500">Placeholder fire hotspot layer</div></div>`
      );
      layer.addLayer(marker);
    });

    map.addLayer(layer);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, visible]);

  return null;
}

function LayerTogglePill({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full bg-white/90 px-3 py-1 text-sm shadow transition ${
        active ? 'text-slate-900 opacity-100' : 'text-slate-600 opacity-65'
      }`}
    >
      <span className="inline-flex items-center gap-2">
        <span>{icon}</span>
        <span>{label}</span>
        <span className={active ? 'opacity-100' : 'opacity-0'}>✓</span>
      </span>
    </button>
  );
}

interface MapViewProps {
  sensors: MapSensor[];
  mapStyle?: MapStyleValue;
  children: React.ReactNode;
  className?: string;
  mapActionHref?: string | null;
}

export function MapView({
  sensors,
  mapStyle = 'dark',
  children,
  className = '',
  mapActionHref = null,
}: MapViewProps) {
  const pathname = usePathname();
  const [isMapReady, setIsMapReady] = useState(false);
  const [showStations, setShowStations] = useState(true);
  const [showHeatMap, setShowHeatMap] = useState(true);
  const [showFires, setShowFires] = useState(false);
  const [showWind, setShowWind] = useState(true);
  const [pluginsReady, setPluginsReady] = useState(false);
  const [latestSensors, setLatestSensors] = useState<LatestSensor[]>([]);
  const [windData, setWindData] = useState<VelocityRecord[] | null>(null);

  const tiles = TILE_LAYERS[mapStyle];
  const mapInstanceKey = useMemo(() => `${pathname}:${mapStyle}`, [pathname, mapStyle]);

  const heatMapPoints = useMemo<Array<[number, number, number]>>(() => {
    if (latestSensors.length > 0) {
      return latestSensors.map((sensor) => {
        const aqi = pm25ToAqi(sensor.pm25);
        return [sensor.lat, sensor.lng, normalizeAqi(aqi)];
      });
    }

    return sensors.map((sensor) => [sensor.lat, sensor.lng, normalizeAqi(sensor.aqi)]);
  }, [latestSensors, sensors]);

  const fetchLatestSensors = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/sensors/latest', { cache: 'no-store', signal });
      if (!response.ok) return;

      const payload = await response.json();
      const data = Array.isArray(payload?.data) ? payload.data : [];

      const normalized = data
        .map((item: Record<string, unknown>): LatestSensor | null => {
          const lat = Number(item.lat);
          const lng = Number(item.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

          return {
            id: typeof item.id === 'string' ? item.id : `${lat}-${lng}`,
            lat,
            lng,
            pm25: Number(item.pm25 ?? 0),
            timestamp:
              typeof item.timestamp === 'string' ? item.timestamp : new Date().toISOString(),
            site: typeof item.site === 'string' ? item.site : null,
          };
        })
        .filter((item: LatestSensor | null): item is LatestSensor => item !== null);

      setLatestSensors(normalized);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.warn('Failed to fetch /api/sensors/latest', error);
    }
  }, []);

  const fetchWind = useCallback(async (signal?: AbortSignal) => {
    try {
      const fieldData = await fetchWindField(signal);
      setWindData(fieldData);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.warn('Failed to fetch Open-Meteo wind data', error);
    }
  }, []);

  useEffect(() => {
    setIsMapReady(true);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadPlugins = async () => {
      try {
        await Promise.all([
          loadPluginScript(
            'leaflet-heat',
            'https://cdn.jsdelivr.net/npm/leaflet.heat@0.2.0/dist/leaflet-heat.js'
          ),
          loadPluginScript(
            'leaflet-velocity',
            'https://cdn.jsdelivr.net/npm/leaflet-velocity@2.1.4/dist/leaflet-velocity.min.js'
          ).catch(() =>
            loadPluginScript(
              'leaflet-velocity',
              'https://cdn.jsdelivr.net/npm/leaflet-velocity@2.1.4/dist/leaflet-velocity.js'
            )
          ),
        ]);
        if (mounted) setPluginsReady(true);
      } catch (error) {
        console.warn('Failed to load Leaflet plugins', error);
      }
    };

    void loadPlugins();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchLatestSensors(controller.signal);

    const intervalId = window.setInterval(() => {
      void fetchLatestSensors();
    }, 30_000);

    return () => {
      window.clearInterval(intervalId);
      controller.abort();
    };
  }, [fetchLatestSensors]);

  useEffect(() => {
    const controller = new AbortController();
    if (showWind) {
      void fetchWind(controller.signal);
    }

    const intervalId = window.setInterval(() => {
      if (showWind) {
        void fetchWind();
      }
    }, 30 * 60 * 1000);

    return () => {
      window.clearInterval(intervalId);
      controller.abort();
    };
  }, [fetchWind, showWind]);

  const toggleStations = () => {
    setShowStations((current) => {
      const next = !current;
      setShowHeatMap(next);
      return next;
    });
  };

  const mapContent = (
    <div
      className={`relative h-full w-full overflow-hidden bg-[#05090f] rounded-b-xl ${className}`}
      role="application"
      aria-label="Air quality map"
    >
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.1),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(16,185,129,0.08),transparent_45%)]" />

      {isMapReady ? (
        <MapContainer
          key={mapInstanceKey}
          center={ALMATY_CENTER}
          zoom={12}
          scrollWheelZoom
          className="h-full w-full"
          style={{ height: '100%', width: '100%', zIndex: 1, position: 'relative' }}
        >
          <TileLayer attribution={tiles.attribution} url={tiles.url} className={tiles.className} />
          {mapStyle === 'dark' ? (
            <TileLayer
              attribution={tiles.attribution}
              url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
              opacity={0.9}
            />
          ) : null}

          <FitToSensors sensors={sensors} />
          <ResizeOnFullscreen fullscreen={false} />

          {pluginsReady ? <HeatMapLayer visible={showHeatMap} points={heatMapPoints} /> : null}
          {pluginsReady ? <WindLayer visible={showWind} data={windData} /> : null}
          <FireLayer visible={showFires} />

          {showStations ? children : null}
        </MapContainer>
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-[rgba(255,255,255,0.08)] border-t-[#5e6ad2]" />
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 z-[500]">
        <div className="pointer-events-auto absolute left-4 top-4">
          {mapActionHref ? (
            <div className="inline-flex items-center rounded-full bg-[#b8962e] px-1 py-1 text-sm text-primary shadow-lg">
              <Link
                href={mapActionHref}
                className="rounded-full px-3 py-1 font-medium hover:bg-black/20"
                aria-label="Open TynysAI map page"
                title="Open map page"
              >
                TynysAI Map
              </Link>
            </div>
          ) : null}
        </div>

        <div className="pointer-events-auto absolute right-4 top-4 flex flex-col items-end gap-2">
          <LayerTogglePill
            icon="📍"
            label="Air quality stations"
            active={showStations}
            onClick={toggleStations}
          />
          <LayerTogglePill
            icon="🔥"
            label="Fires"
            active={showFires}
            onClick={() => setShowFires((current) => !current)}
          />
          <LayerTogglePill
            icon="💨"
            label="Wind"
            active={showWind}
            onClick={() => setShowWind((current) => !current)}
          />
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            {IQAIR_LEGEND.map((segment) => (
              <div
                key={segment.label}
                className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-primary sm:text-[11px]"
                style={{ backgroundColor: segment.color }}
              >
                {segment.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return mapContent;
}
