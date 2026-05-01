
'use client';

import React from 'react';

import { useEffect, useState, useCallback } from 'react';
import { sensorAPI, AirQualityData } from '@/lib/api';

/**
 * Unified map sensor type for both air quality API and purchased sensors.
 * Used by MapView to render markers dynamically.
 */
export interface MapSensor {
  id: string;
  lat: number;
  lng: number;
  aqi: number;
  isPurchased: boolean;
  isDemo?: boolean;
  markerIndex?: number;
  device_name?: string;
  device_id?: string;
  label?: string;
  site?: string;
  name?: string;
  city?: string;
  state?: string;
  country?: string;
  description?: string;
  parameters?: Record<string, number>;
  /** ISO timestamp of last data reading */
  timestamp?: string;
  /** Raw air quality data if from IQAir API */
  airQualityData?: AirQualityData;
}

export interface UseSensorsOnMapResult {
  sensors: MapSensor[];
  /** Raw air quality data (from IQAir API) for sidebar/stats */
  allAirQuality: AirQualityData[];
  loading: boolean;
  /** Alias for loading (e.g. for consistency with isLoading naming) */
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const FIXED_MARKER_COORDS: Array<[number, number]> = [
  [43.216124, 76.880444],
  [43.21825, 76.920739],
  [43.233797, 76.761204],
  [43.223431, 76.901261],
  [43.245644, 76.889126],
  [43.264688, 76.918148],
  [43.246987, 76.958445],
  [43.254494, 76.953902],
  [43.369441, 77.310747],
  [43.225782, 76.930466],
  [43.230413, 76.910433],
  [43.256511, 76.826015],
  [43.216466, 76.776729],
  [43.344326, 76.914315],
  [43.21086, 76.861406],
  [43.229065, 76.933489],
  [43.22676, 76.910461],
  [43.23259, 76.88285],
  [43.224489, 76.923981],
  [43.236987, 76.934981],
];

function applyFixedMarkerPositions(sensors: MapSensor[]): MapSensor[] {
  const ordered = [...sensors].sort((a, b) => a.id.localeCompare(b.id));
  return ordered.map((sensor, index) => {
    const [lat, lng] = FIXED_MARKER_COORDS[index % FIXED_MARKER_COORDS.length];
    return {
      ...sensor,
      lat,
      lng,
      markerIndex: index + 1,
    };
  });
}

function sensorsSignature(sensors: MapSensor[]): string {
  return JSON.stringify(
    sensors.map((sensor) => [
      sensor.id,
      sensor.lat,
      sensor.lng,
      sensor.aqi,
      sensor.timestamp ?? null,
      sensor.device_id ?? null,
      sensor.name ?? null,
    ])
  );
}

/**
 * Converts AirQualityData to MapSensor
 */
function airQualityToMapSensor(data: AirQualityData, index: number): MapSensor | null {
  const coords = data?.location?.coordinates;
  if (!coords || coords.length < 2) return null;
  const [lon, lat] = coords;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  const aqi = data?.current?.pollution?.aqius ?? 0;
  return {
    id: `aq-${data.city}-${data.state}-${index}`,
    lat,
    lng: lon,
    aqi,
    isPurchased: false,
    name: data?.sensor_data?.site ?? data?.city ?? 'Станция',
    city: data?.city,
    state: data?.state,
    country: data?.country,
    airQualityData: data,
  };
}

/**
 * Converts purchased sensor from map API to MapSensor
 */
function purchasedSensorToMapSensor(s: any, index: number): MapSensor | null {
  const lat = s?.lat ?? s?.location?.coordinates?.[1];
  const lng = s?.lng ?? s?.location?.coordinates?.[0];
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return {
    id: `sensor-${s?.id ?? index}`,
    lat,
    lng,
    aqi: s?.aqi ?? 0,
    isPurchased: true,
    name: s?.name ?? 'Платный датчик',
    device_name: s?.device_name,
    device_id: s?.device_id,
    label: s?.label,
    site: s?.site,
    city: s?.city,
    country: s?.country,
    description: s?.description,
    parameters: s?.parameters ?? {},
  };
}

/**
 * Hook that fetches sensor data for the map from:
 * - airQualityAPI.getAllAirQuality() (IQAir stations)
 * - sensorAPI.mapSensors() (purchased sensors, when user is logged in)
 *
 * Supports periodic refetch so the map updates when database changes.
 */
export function useSensorsOnMap(
  options: {
    /** If set, fetches purchased sensors (requires auth) */
    userId?: string | null;
    /** Refetch interval in ms. Set to 0 or undefined to disable */
    refetchIntervalMs?: number;
  } = {}
): UseSensorsOnMapResult {
  const { userId, refetchIntervalMs = 60_000 } = options;
  const [sensors, setSensors] = useState<MapSensor[]>([]);
  const [allAirQuality, setAllAirQuality] = useState<AirQualityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Only log error once per error occurrence
  const lastErrorRef = React.useRef<string | null>(null);
  const hasLoadedOnceRef = React.useRef(false);
  const requestInFlightRef = React.useRef<Promise<void> | null>(null);
  const lastSensorsSignatureRef = React.useRef<string>('');

  const refetch = useCallback(async () => {
    if (requestInFlightRef.current) {
      return requestInFlightRef.current;
    }

    const requestPromise = (async () => {
      if (!hasLoadedOnceRef.current) {
        setLoading(true);
      }
      setError(null);
      try {
        const purchasedRawSensors = await sensorAPI.mapSensors().catch((err) => {
          console.warn('[SensorsOnMap] mapSensors fetch error:', err?.message || err);
          return [];
        });

        const purchasedSensors = (Array.isArray(purchasedRawSensors) ? purchasedRawSensors : [])
          .map((sensor, i) => purchasedSensorToMapSensor(sensor, i))
          .filter((sensor): sensor is MapSensor => sensor !== null);

        const mapSensors = applyFixedMarkerPositions(purchasedSensors);
        const nextSignature = sensorsSignature(mapSensors);

        if (nextSignature !== lastSensorsSignatureRef.current) {
          console.log('[SensorsOnMap] Processed sensors:', mapSensors.length, mapSensors);
          setSensors(mapSensors);
          lastSensorsSignatureRef.current = nextSignature;
        }
        setAllAirQuality((prev) => (prev.length === 0 ? prev : []));

        if (mapSensors.length === 0 && purchasedSensors.length > 0) {
          console.error('[SensorsOnMap] Failed to process sensors from response:', purchasedSensors);
        }
        lastErrorRef.current = null;
      } catch (e: any) {
        const errMsg = e?.message ?? 'Failed to load sensors';
        setError(errMsg);
        if (lastErrorRef.current !== errMsg) {
          console.warn('[SensorsOnMap]', errMsg);
          lastErrorRef.current = errMsg;
        }
      } finally {
        hasLoadedOnceRef.current = true;
        setLoading(false);
      }
    })();

    requestInFlightRef.current = requestPromise;
    try {
      await requestPromise;
    } finally {
      requestInFlightRef.current = null;
    }
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (refetchIntervalMs <= 0) return;
    const interval = setInterval(refetch, refetchIntervalMs);
    return () => clearInterval(interval);
  }, [refetchIntervalMs, refetch]);

  return { sensors, allAirQuality, loading, isLoading: loading, error, refetch };
}
