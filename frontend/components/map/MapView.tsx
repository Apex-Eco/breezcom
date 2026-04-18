'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapSensor } from '@/hooks/useSensorsOnMap';
import type { MapStyleValue } from './types';
import { getAqiColor } from '@/lib/map-aqi';

// Fix for default marker icons (only on client)
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  });
}

const ALMATY_CENTER: [number, number] = [43.2565, 76.9285];

const AQI_LEGEND_BANDS = [
  { label: '0-50', color: getAqiColor(50) },
  { label: '51-100', color: getAqiColor(100) },
  { label: '101-150', color: getAqiColor(150) },
  { label: '151-200', color: getAqiColor(200) },
  { label: '201+', color: getAqiColor(201) },
];

const TILE_LAYERS: Record<
  MapStyleValue,
  { url: string; attribution: string; className?: string }
> = {
  standard: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    className: 'dark-map-tiles',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
  },
};

function FitToSensors({ sensors }: { sensors: MapSensor[] }) {
  const map = useMap();
  const hasFitted = useRef(false);

  // Центрируем карту ТОЛЬКО при первой загрузке данных
  useEffect(() => {
    if (hasFitted.current) return;
    if (!sensors.length) return;

    hasFitted.current = true;
    const points: [number, number][] = sensors.map((s) => [s.lat, s.lng]);
    if (points.length === 1) {
      map.setView(points[0], 13);
    } else {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [map, sensors]);

  useEffect(() => {
    const handleResize = () => {
      setTimeout(() => map.invalidateSize(), 100);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [map]);

  return null;
}

interface MapViewProps {
  sensors: MapSensor[];
  mapStyle?: MapStyleValue;
  children: React.ReactNode;
  className?: string;
}

export function MapView({
  sensors,
  mapStyle = 'standard',
  children,
  className = '',
}: MapViewProps) {
  const tiles = TILE_LAYERS[mapStyle];

  return (
    <div className={`h-full w-full relative ${className}`} role="application" aria-label="Air quality map">
      <MapContainer
        center={ALMATY_CENTER}
        zoom={12}
        scrollWheelZoom
        className="h-full w-full rounded-b-3xl"
        style={{ height: '100%', width: '100%', zIndex: 1, position: 'relative' }}
      >
        <TileLayer
          key={mapStyle}
          attribution={tiles.attribution}
          url={tiles.url}
          className={tiles.className}
        />
        <FitToSensors sensors={sensors} />
        {children}
      </MapContainer>

      <div className="absolute bottom-4 left-4 z-[500] pointer-events-none">
        <div className="rounded-xl border border-white/20 bg-black/70 px-3 py-2 backdrop-blur">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-white/90">AQI</div>
          <div className="space-y-1">
            {AQI_LEGEND_BANDS.map((band) => (
              <div key={band.label} className="flex items-center gap-2 text-[10px] text-white/90">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full border border-black/40"
                  style={{ backgroundColor: band.color }}
                  aria-hidden
                />
                <span>{band.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
