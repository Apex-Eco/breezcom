"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import type { LatLngTuple } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { cn } from "@/lib/utils";
import type { MapReading } from "@/types/map-reading";

const ALMATY_CENTER: LatLngTuple = [43.238949, 76.889709];

const AQI_BREAKPOINTS = [
  { limit: 50, color: "#22c55e", label: "Good", range: "0-50", tw: "bg-green-500" },
  { limit: 100, color: "#eab308", label: "Moderate", range: "51-100", tw: "bg-yellow-500" },
  { limit: 150, color: "#f97316", label: "USG", range: "101-150", tw: "bg-orange-500" },
  { limit: 200, color: "#ef4444", label: "Unhealthy", range: "151-200", tw: "bg-red-500" },
  { limit: 300, color: "#8b5cf6", label: "Very Unhealthy", range: "201-300", tw: "bg-violet-500" },
  { limit: Infinity, color: "#7f1d1d", label: "Hazardous", range: "301+", tw: "bg-red-900" },
];

const LEGEND_SEGMENTS = [
  { label: "Good", bg: "#22c55e" },
  { label: "Moderate", bg: "#eab308" },
  { label: "Unhealthy for sensitive groups", bg: "#f97316" },
  { label: "Unhealthy", bg: "#ef4444" },
  { label: "Very unhealthy", bg: "#8b5cf6" },
  { label: "Hazardous", bg: "#7f1d1d" },
];

const FIRE_LOCATIONS: Array<{ name: string; coords: LatLngTuple }> = [
  { name: "Alatau Industrial Zone", coords: [43.281, 76.78] },
  { name: "Aksai Industrial Cluster", coords: [43.247, 76.793] },
  { name: "Turksib Rail Yard", coords: [43.343, 76.971] },
  { name: "Sairan Heat Spot", coords: [43.219, 76.84] },
];

type AggregatedPoint = {
  key: string;
  coords: LatLngTuple;
  count: number;
  avgValue: number;
  latestValue: number;
  lastTimestamp: string;
  sensorIds: string[];
};

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

type MarkerCluster = {
  getAllChildMarkers: () => L.Marker[];
};

type MarkerClusterGroup = L.LayerGroup & {
  addLayer: (layer: L.Layer) => MarkerClusterGroup;
};

type MarkerClusterGroupFactory = (options?: {
  iconCreateFunction?: (cluster: MarkerCluster) => L.DivIcon;
  chunkedLoading?: boolean;
  showCoverageOnHover?: boolean;
  spiderfyOnMaxZoom?: boolean;
}) => MarkerClusterGroup;

type LeafletWithPlugins = typeof L & {
  markerClusterGroup?: MarkerClusterGroupFactory;
  heatLayer?: (
    latlngs: Array<[number, number, number]>,
    options?: Record<string, unknown>
  ) => L.Layer;
  velocityLayer?: (options: Record<string, unknown>) => L.Layer;
};

function safeIsoTimestamp(timestamp?: string | null): string {
  if (!timestamp) return new Date(0).toISOString();
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseLocation(location?: string | null): LatLngTuple | null {
  if (!location) return null;
  const [latStr, lngStr] = location.split(",").map((part) => part.trim());
  const lat = Number(latStr);
  const lng = Number(lngStr);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  return [lat, lng];
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

function aggregatePoints(readings: MapReading[]): AggregatedPoint[] {
  const map = new Map<string, AggregatedPoint>();

  readings.forEach((reading) => {
    const coords = parseLocation(reading.location);
    if (!coords) return;

    const key = reading.location!.trim();
    const existing = map.get(key);
    const timestamp = safeIsoTimestamp(reading.timestamp);

    if (!existing) {
      map.set(key, {
        key,
        coords,
        count: 1,
        avgValue: reading.value,
        latestValue: reading.value,
        lastTimestamp: timestamp,
        sensorIds: [reading.sensorId],
      });
      return;
    }

    const count = existing.count + 1;
    const avgValue = (existing.avgValue * existing.count + reading.value) / count;
    const isNewer = timestamp > existing.lastTimestamp;
    const sensorIds = existing.sensorIds.includes(reading.sensorId)
      ? existing.sensorIds
      : [...existing.sensorIds, reading.sensorId];

    map.set(key, {
      ...existing,
      count,
      avgValue,
      latestValue: isNewer ? reading.value : existing.latestValue,
      lastTimestamp: isNewer ? timestamp : existing.lastTimestamp,
      sensorIds,
    });
  });

  return Array.from(map.values());
}

function createPointIcon(value: number) {
  const bp =
    AQI_BREAKPOINTS.find((b) => value <= b.limit) ??
    AQI_BREAKPOINTS[AQI_BREAKPOINTS.length - 1];
  const html = `
    <div class="flex items-center justify-center rounded-full text-[10px] font-semibold text-white shadow-lg border border-white/20 ${bp.tw}"
         style="width:28px;height:28px;">
      ${Math.round(value)}
    </div>
  `;

  const iconOptions: L.DivIconOptions & { aqiValue: number } = {
    className: "aqi-point-icon",
    html,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
    aqiValue: value,
  };

  return L.divIcon(iconOptions);
}

function createClusterIcon(cluster: MarkerCluster) {
  const childMarkers = cluster.getAllChildMarkers() as L.Marker[];
  const values = childMarkers.map((m) => {
    const opts = (m.options.icon?.options ?? {}) as { aqiValue?: number };
    return opts.aqiValue ?? 0;
  });

  const avg = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const bp =
    AQI_BREAKPOINTS.find((b) => avg <= b.limit) ??
    AQI_BREAKPOINTS[AQI_BREAKPOINTS.length - 1];
  const size = Math.min(44 + values.length, 76);

  const html = `
    <div class="flex items-center justify-center rounded-full text-xs font-semibold text-white shadow-lg border border-white/20 ${bp.tw}"
         style="width:${size}px;height:${size}px;">
      ${values.length}
    </div>
  `;

  const iconOptions: L.DivIconOptions = {
    className: "aqi-cluster-icon",
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  };

  return L.divIcon(iconOptions);
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
        parameterUnit: "m/s",
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
        parameterUnit: "m/s",
      },
      data: vData,
    },
  ];
}

async function fetchWindField(signal?: AbortSignal): Promise<VelocityRecord[]> {
  const params = new URLSearchParams({
    latitude: "43.25",
    longitude: "76.93",
    hourly: "wind_u_component_10m,wind_v_component_10m",
    timezone: "Asia/Almaty",
    forecast_days: "1",
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
    signal,
    cache: "no-store",
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
    typeof timeSeries[bestIndex] === "string"
      ? new Date(timeSeries[bestIndex]).toISOString()
      : new Date().toISOString();

  return buildVelocityField(baseU, baseV, refTime);
}

function FitToMarkers({ points }: { points: AggregatedPoint[] }) {
  const map = useMap();
  const hasFit = useRef(false);

  useEffect(() => {
    if (!map || hasFit.current) return;
    if (points.length === 0) {
      map.setView(ALMATY_CENTER, 11);
      hasFit.current = true;
      return;
    }

    const bounds = L.latLngBounds(points.map((point) => point.coords));
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 13 });
    hasFit.current = true;
  }, [map, points]);

  return null;
}

function ResizeOnFullscreen({ fullscreen }: { fullscreen: boolean }) {
  const map = useMap();

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      map.invalidateSize();
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [map, fullscreen]);

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
        0.0: "green",
        0.33: "yellow",
        0.66: "orange",
        1.0: "red",
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
      colorScale: ["#ffffff", "#e2e8f0", "#cbd5e1"],
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
      className: "fire-hotspot-icon",
      html: '<div style="font-size:18px;line-height:18px;filter:drop-shadow(0 0 4px rgba(251,146,60,.9));">🔥</div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      popupAnchor: [0, -8],
    });

    const layer = L.layerGroup();

    FIRE_LOCATIONS.forEach((fire) => {
      const marker = L.marker(fire.coords, { icon: fireIcon });
      marker.bindPopup(
        `<div class="space-y-1 text-sm"><div class="font-semibold">${escapeHtml(
          fire.name
        )}</div><div class="text-xs text-slate-500">Placeholder fire hotspot layer</div></div>`
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

function ClusterLayer({ points, visible }: { points: AggregatedPoint[]; visible: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !visible) return;

    const buildMarker = (point: AggregatedPoint): L.Marker => {
      const marker = L.marker(point.coords, { icon: createPointIcon(point.avgValue) });
      const safePointKey = escapeHtml(point.key);
      const tooltipHtml = `
        <div class="space-y-1 text-xs">
          <div class="font-semibold">${safePointKey}</div>
          <div>Avg: ${point.avgValue.toFixed(1)}</div>
          <div>Latest: ${point.latestValue.toFixed(1)}</div>
          <div>Samples: ${point.count}</div>
        </div>
      `;
      marker.bindTooltip(tooltipHtml, {
        direction: "top",
        offset: [0, -2],
        permanent: false,
        sticky: true,
      });

      const sensorsHtml = point.sensorIds
        .map((id) => `<span class="text-blue-600">${escapeHtml(id)}</span>`)
        .join("<br/>");
      const popupHtml = `
        <div class="space-y-1 text-sm">
          <div class="font-semibold">${safePointKey}</div>
          <div>Avg: ${point.avgValue.toFixed(2)}</div>
          <div>Latest: ${point.latestValue.toFixed(2)}</div>
          <div>Samples: ${point.count}</div>
          <div class="text-xs text-muted-foreground">Sensors:<br/>${sensorsHtml}</div>
          <div class="text-[11px] text-muted-foreground">Updated: ${new Date(point.lastTimestamp).toLocaleString()}</div>
        </div>
      `;
      marker.bindPopup(popupHtml);
      return marker;
    };

    let activeLayer: L.Layer | null = null;

    const markerClusterGroup = (L as LeafletWithPlugins).markerClusterGroup;
    if (markerClusterGroup) {
      const clusterGroup = markerClusterGroup({
        iconCreateFunction: (cluster) => createClusterIcon(cluster),
        chunkedLoading: true,
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
      });
      points.forEach((point) => {
        clusterGroup.addLayer(buildMarker(point));
      });
      activeLayer = clusterGroup;
    } else {
      const fallbackLayer = L.layerGroup();
      points.forEach((point) => {
        fallbackLayer.addLayer(buildMarker(point));
      });
      activeLayer = fallbackLayer;
    }

    map.addLayer(activeLayer);

    return () => {
      if (activeLayer) map.removeLayer(activeLayer);
    };
  }, [map, points, visible]);

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
      className={cn(
        "rounded-full bg-white/90 px-3 py-1 text-sm shadow transition",
        active ? "text-slate-900 opacity-100" : "text-slate-600 opacity-65"
      )}
    >
      <span className="inline-flex items-center gap-2">
        <span>{icon}</span>
        <span>{label}</span>
        <span className={active ? "opacity-100" : "opacity-0"}>✓</span>
      </span>
    </button>
  );
}

export function AirQualityMap({
  readings,
  emptyStateText,
  heightClass = "h-[420px]",
  className,
  pollingMs = 30000,
  onPoll,
}: {
  readings: MapReading[];
  emptyStateText: string;
  heightClass?: string;
  className?: string;
  pollingMs?: number;
  onPoll?: (signal: AbortSignal) => Promise<void> | void;
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showStations, setShowStations] = useState(true);
  const [showHeatMap, setShowHeatMap] = useState(true);
  const [showFires, setShowFires] = useState(false);
  const [showWind, setShowWind] = useState(true);
  const [latestSensors, setLatestSensors] = useState<LatestSensor[]>([]);
  const [windData, setWindData] = useState<VelocityRecord[] | null>(null);
  const [pluginsReady, setPluginsReady] = useState(false);

  const points = useMemo(() => aggregatePoints(readings), [readings]);

  const fallbackPoints = useMemo<AggregatedPoint[]>(
    () =>
      latestSensors.map((sensor) => {
        const aqiValue = pm25ToAqi(sensor.pm25);
        return {
          key: sensor.site
            ? `${sensor.site} (${sensor.lat.toFixed(4)}, ${sensor.lng.toFixed(4)})`
            : `${sensor.lat.toFixed(4)}, ${sensor.lng.toFixed(4)}`,
          coords: [sensor.lat, sensor.lng],
          count: 1,
          avgValue: aqiValue,
          latestValue: aqiValue,
          lastTimestamp: safeIsoTimestamp(sensor.timestamp),
          sensorIds: [sensor.id],
        };
      }),
    [latestSensors]
  );

  const displayPoints = points.length > 0 ? points : fallbackPoints;

  const heatMapPoints = useMemo<Array<[number, number, number]>>(
    () =>
      latestSensors.map((sensor) => {
        const aqi = pm25ToAqi(sensor.pm25);
        return [sensor.lat, sensor.lng, normalizeAqi(aqi)];
      }),
    [latestSensors]
  );

  const fetchLatestSensors = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/sensors/latest", { cache: "no-store", signal });
      if (!response.ok) return;

      const payload = await response.json();
      const data = Array.isArray(payload?.data) ? payload.data : [];

      const normalized = data
        .map((item: Record<string, unknown>): LatestSensor | null => {
          const lat = Number(item.lat);
          const lng = Number(item.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

          return {
            id: typeof item.id === "string" ? item.id : `${lat}-${lng}`,
            lat,
            lng,
            pm25: Number(item.pm25 ?? 0),
            timestamp: typeof item.timestamp === "string" ? item.timestamp : new Date().toISOString(),
            site: typeof item.site === "string" ? item.site : null,
          };
        })
        .filter((item: LatestSensor | null): item is LatestSensor => item !== null);

      setLatestSensors(normalized);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.warn("Failed to fetch /api/sensors/latest", error);
    }
  }, []);

  const fetchWind = useCallback(async (signal?: AbortSignal) => {
    try {
      const fieldData = await fetchWindField(signal);
      setWindData(fieldData);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.warn("Failed to fetch Open-Meteo wind data", error);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadPlugins = async () => {
      try {
        await Promise.all([import("leaflet.heat"), import("leaflet-velocity")]);
        if (mounted) setPluginsReady(true);
      } catch (error) {
        console.warn("Failed to load Leaflet plugins", error);
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

    if (pollingMs <= 0) {
      return () => {
        controller.abort();
      };
    }

    const intervalId = window.setInterval(() => {
      void fetchLatestSensors();
    }, pollingMs);

    return () => {
      window.clearInterval(intervalId);
      controller.abort();
    };
  }, [fetchLatestSensors, pollingMs]);

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

  useEffect(() => {
    if (!onPoll || pollingMs <= 0) return;
    const controller = new AbortController();
    const runPoll = () => {
      void onPoll(controller.signal);
    };

    runPoll();
    const intervalId = window.setInterval(runPoll, pollingMs);
    return () => {
      window.clearInterval(intervalId);
      controller.abort();
    };
  }, [onPoll, pollingMs]);

  useEffect(() => {
    document.body.style.overflow = isFullscreen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) return;

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("keydown", onEscape);
    };
  }, [isFullscreen]);

  const toggleStations = () => {
    setShowStations((current) => {
      const next = !current;
      setShowHeatMap(next);
      return next;
    });
  };

  const mapContent = (
    <div
      className={cn(
        "relative w-full overflow-hidden border border-slate-800/70 bg-[#03070b]",
        isFullscreen
          ? "fixed inset-0 z-[1200] h-screen w-screen rounded-none"
          : ["rounded-lg", heightClass],
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.1),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(16,185,129,0.08),transparent_45%)]" />

      <MapContainer center={ALMATY_CENTER} zoom={11} scrollWheelZoom className="h-full w-full bg-[#03070b] z-0">
        <TileLayer
          attribution="&copy; OpenStreetMap contributors &copy; CARTO"
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
        />
        <TileLayer
          attribution="&copy; OpenStreetMap contributors &copy; CARTO"
          url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
          opacity={0.9}
        />

        <FitToMarkers points={displayPoints} />
        <ResizeOnFullscreen fullscreen={isFullscreen} />

        {pluginsReady ? <HeatMapLayer visible={showHeatMap} points={heatMapPoints} /> : null}
        {pluginsReady ? <WindLayer visible={showWind} data={windData} /> : null}

        <FireLayer visible={showFires} />
        <ClusterLayer points={displayPoints} visible={showStations} />
      </MapContainer>

      <div className="pointer-events-none absolute inset-0 z-30">
        <div className="pointer-events-auto absolute left-4 top-4">
          <div className="inline-flex items-center rounded-full bg-[#b8962e] px-3 py-1 text-sm text-white shadow-lg">
            <span>🗺 Tynys Map</span>
            <button
              type="button"
              onClick={() => setIsFullscreen((current) => !current)}
              className="ml-3 rounded-full bg-black/20 px-2 py-0.5 text-sm hover:bg-black/35"
              aria-label="Toggle fullscreen map"
              title="Toggle fullscreen"
            >
              ⛶
            </button>
          </div>
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

        {displayPoints.length === 0 ? (
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-slate-300">
            {emptyStateText}
          </div>
        ) : null}

        <div className="absolute bottom-0 left-0 right-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            {LEGEND_SEGMENTS.map((segment) => (
              <div
                key={segment.label}
                className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-white sm:text-[11px]"
                style={{ backgroundColor: segment.bg }}
              >
                {segment.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  if (isFullscreen && typeof document !== "undefined") {
    return createPortal(mapContent, document.body);
  }

  return mapContent;
}
