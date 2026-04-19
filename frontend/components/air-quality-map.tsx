"use client";

import { useEffect, useMemo, useRef } from "react"; // [perf-fix]
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import type { LatLngTuple } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { cn } from "@/lib/utils";
import type { MapReading } from "@/types/map-reading";

const AQI_BREAKPOINTS = [
  { limit: 50, color: "#22c55e", label: "Good", range: "0-50", tw: "bg-green-500" }, // [bug-fix]
  { limit: 100, color: "#84cc16", label: "Moderate", range: "51-100", tw: "bg-lime-500" }, // [bug-fix]
  { limit: 150, color: "#eab308", label: "USG", range: "101-150", tw: "bg-amber-500" }, // [bug-fix]
  { limit: 200, color: "#f97316", label: "Unhealthy", range: "151-200", tw: "bg-orange-500" }, // [bug-fix]
  { limit: 300, color: "#ef4444", label: "Very Unhealthy", range: "201-300", tw: "bg-red-500" }, // [bug-fix]
  { limit: Infinity, color: "#7e22ce", label: "Hazardous", range: "300+", tw: "bg-purple-700" }, // [bug-fix]
];

const AQI_LEVELS = [
  { label: "Good", colorClass: "bg-[#22c55e]", range: "0-50" },
  { label: "Moderate", colorClass: "bg-[#84cc16]", range: "51-100" },
  { label: "USG", colorClass: "bg-[#eab308]", range: "101-150" },
  { label: "Unhealthy", colorClass: "bg-[#f97316]", range: "151-200" },
  { label: "Very Unhealthy", colorClass: "bg-[#ef4444]", range: "201-300" },
  { label: "Hazardous", colorClass: "bg-[#7e22ce]", range: "300+" },
];

const DEFAULT_CENTER: LatLngTuple = [37.0902, -95.7129];

function safeIsoTimestamp(timestamp?: string | null): string { // [bug-fix]
  if (!timestamp) return new Date(0).toISOString(); // [bug-fix]
  const date = new Date(timestamp); // [bug-fix]
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString(); // [bug-fix]
} // [bug-fix]

function escapeHtml(value: string): string { // [bug-fix]
  return value // [bug-fix]
    .replaceAll("&", "&amp;") // [bug-fix]
    .replaceAll("<", "&lt;") // [bug-fix]
    .replaceAll(">", "&gt;") // [bug-fix]
    .replaceAll('"', "&quot;") // [bug-fix]
    .replaceAll("'", "&#39;"); // [bug-fix]
} // [bug-fix]

function parseLocation(location?: string | null): LatLngTuple | null {
  if (!location) return null;
  const [latStr, lngStr] = location.split(",").map((part) => part.trim());
  const lat = Number(latStr);
  const lng = Number(lngStr);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  return [lat, lng];
}

type AggregatedPoint = {
  key: string;
  coords: LatLngTuple;
  count: number;
  avgValue: number;
  latestValue: number;
  lastTimestamp: string;
  sensorIds: string[];
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

function aggregatePoints(readings: MapReading[]): AggregatedPoint[] {
  const map = new Map<string, AggregatedPoint>();

  readings.forEach((reading) => {
    const coords = parseLocation(reading.location);
    if (!coords) return;

    const key = reading.location!.trim();
    const existing = map.get(key);
    const timestamp = safeIsoTimestamp(reading.timestamp); // [bug-fix]

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
    <div class="flex items-center justify-center rounded-full text-[10px] font-semibold text-primary-foreground shadow-lg border border-border/70 ${bp.tw}"
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
    <div class="flex items-center justify-center rounded-full text-xs font-semibold text-primary-foreground shadow-lg border border-border/70 ${bp.tw}"
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

function FitToMarkers({ points }: { points: AggregatedPoint[] }) {
  const map = useMap();
  const hasFit = useRef(false); // [perf-fix]

  useEffect(() => {
    if (!map || points.length === 0 || hasFit.current) return; // [perf-fix]
    const bounds = L.latLngBounds(points.map((point) => point.coords));
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 13 });
    hasFit.current = true; // [perf-fix]
  }, [map, points]);

  return null;
}

export function AirQualityMap({
  readings,
  emptyStateText,
  heightClass = "h-[420px]",
  className,
  pollingMs = 30000, // [perf-fix]
  onPoll, // [perf-fix]
}: {
  readings: MapReading[];
  emptyStateText: string;
  heightClass?: string;
  className?: string;
  pollingMs?: number; // [perf-fix]
  onPoll?: (signal: AbortSignal) => Promise<void> | void; // [perf-fix]
}) {
  const points = useMemo(() => aggregatePoints(readings), [readings]);

  useEffect(() => { // [perf-fix]
    if (!onPoll || pollingMs <= 0) return; // [perf-fix]
    const controller = new AbortController(); // [bug-fix]
    const runPoll = () => { // [perf-fix]
      void onPoll(controller.signal); // [perf-fix]
    }; // [perf-fix]
    runPoll(); // [perf-fix]
    const intervalId = window.setInterval(runPoll, pollingMs); // [perf-fix]
    return () => { // [bug-fix]
      window.clearInterval(intervalId); // [bug-fix]
      controller.abort(); // [bug-fix]
    }; // [bug-fix]
  }, [onPoll, pollingMs]); // [perf-fix]

  if (points.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border border-dashed border-slate-800/60 text-sm text-muted-foreground",
          heightClass
        )}
      >
        {emptyStateText}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-lg border border-slate-800/70 bg-background",
        heightClass,
        className
      )}
    >
      <div className="relative flex flex-wrap items-center gap-4 overflow-visible border-b border-slate-800/60 bg-background/80 px-4 py-2 backdrop-blur">
        <LegendBar />
      </div>

      <div className="relative flex-1 overflow-hidden rounded-b-lg">
        <MapContainer center={DEFAULT_CENTER} zoom={5} scrollWheelZoom className="h-full w-full bg-background z-0"> {/* [perf-fix] */}
          <TileLayer
            attribution="&copy; OpenStreetMap contributors &copy; CARTO" // [perf-fix]
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" // [perf-fix]
          />
          <FitToMarkers points={points} />
          <ClusterLayer points={points} />
        </MapContainer>
      </div>
    </div>
  );
}

function LegendBar() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      {AQI_LEVELS.map((level) => (
        <div key={level.label} className="inline-flex cursor-default items-center gap-2" title={`AQI Range: ${level.range}`}>
          <span className={cn("h-2.5 w-2.5 rounded-full", level.colorClass)} aria-hidden />
          <span className="font-medium text-foreground/90">{level.label}</span>
        </div>
      ))}
    </div>
  );
}

function ClusterLayer({ points }: { points: AggregatedPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const buildMarker = (point: AggregatedPoint): L.Marker => { // [bug-fix]
      const marker = L.marker(point.coords, { icon: createPointIcon(point.avgValue) }); // [perf-fix]
      const safePointKey = escapeHtml(point.key); // [bug-fix]
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

      const sensorsHtml = point.sensorIds // [bug-fix]
        .map((id) => `<span class="text-blue-600">${escapeHtml(id)}</span>`) // [bug-fix]
        .join("<br/>"); // [bug-fix]
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
      return marker; // [bug-fix]
    }; // [bug-fix]

    let activeLayer: L.Layer | null = null; // [bug-fix]

    const markerClusterGroup = (L as typeof L & { markerClusterGroup?: MarkerClusterGroupFactory })
      .markerClusterGroup;

    if (markerClusterGroup) { // [perf-fix]
      const clusterGroup = markerClusterGroup({ // [perf-fix]
        iconCreateFunction: (cluster) => createClusterIcon(cluster), // [perf-fix]
        chunkedLoading: true, // [perf-fix]
        showCoverageOnHover: false, // [perf-fix]
        spiderfyOnMaxZoom: true, // [perf-fix]
      }); // [perf-fix]
      points.forEach((point) => { // [perf-fix]
        clusterGroup.addLayer(buildMarker(point)); // [perf-fix]
      }); // [perf-fix]
      activeLayer = clusterGroup; // [perf-fix]
    } else { // [bug-fix]
      const fallbackLayer = L.layerGroup(); // [bug-fix]
      points.forEach((point) => { // [bug-fix]
        fallbackLayer.addLayer(buildMarker(point)); // [bug-fix]
      }); // [bug-fix]
      activeLayer = fallbackLayer; // [bug-fix]
    } // [bug-fix]

    map.addLayer(activeLayer); // [bug-fix]

    return () => {
      if (activeLayer) map.removeLayer(activeLayer); // [bug-fix]
    };
  }, [map, points]);

  return null;
}
