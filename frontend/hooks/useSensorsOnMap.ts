
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

type LatestSensorApiRow = {
  id?: string;
  lat?: number;
  lng?: number;
  pm25?: number;
  timestamp?: string;
  site?: string | null;
};

type LatestSensorApiResponse = {
  success?: boolean;
  data?: LatestSensorApiRow[];
};

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

function latestSensorToMapSensor(s: LatestSensorApiRow, index: number): MapSensor | null {
  const lat = Number(s?.lat);
  const lng = Number(s?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const pm25 = Number(s?.pm25 ?? 0);
  const safePm25 = Number.isFinite(pm25) ? pm25 : 0;

  return {
    id: `latest-${s?.id ?? index}`,
    lat,
    lng,
    aqi: pm25ToAqi(safePm25),
    isPurchased: false,
    name: s?.site ?? s?.id ?? 'Live sensor',
    site: s?.site ?? undefined,
    device_id: s?.id,
    city: 'Almaty',
    country: 'Kazakhstan',
    timestamp: s?.timestamp,
    parameters: {
      pm25: safePm25,
    },
  };
}

async function fetchLatestSensors(): Promise<LatestSensorApiRow[]> {
  const response = await fetch('/api/sensors/latest', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Latest sensors request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as LatestSensorApiResponse;
  return Array.isArray(payload?.data) ? payload.data : [];
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
        const [latestRawSensors, purchasedRawSensors] = await Promise.all([
          fetchLatestSensors().catch((err) => {
            console.warn('[SensorsOnMap] latest sensors fetch error:', err?.message || err);
            return [];
          }),
          userId
            ? sensorAPI.mapSensors().catch((err) => {
                console.warn('[SensorsOnMap] mapSensors fetch error:', err?.message || err);
                return [];
              })
            : Promise.resolve([]),
        ]);

        const latestSensors = (Array.isArray(latestRawSensors) ? latestRawSensors : [])
          .map((sensor, i) => latestSensorToMapSensor(sensor, i))
          .filter((sensor): sensor is MapSensor => sensor !== null);

        const purchasedSensors = (Array.isArray(purchasedRawSensors) ? purchasedRawSensors : [])
          .map((sensor, i) => purchasedSensorToMapSensor(sensor, i))
          .filter((sensor): sensor is MapSensor => sensor !== null);

        const mapSensors = [...latestSensors, ...purchasedSensors].map((sensor, index) => ({
          ...sensor,
          markerIndex: index + 1,
        }));
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
