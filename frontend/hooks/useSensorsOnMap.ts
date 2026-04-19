
'use client';

import React from 'react';

import { useEffect, useState, useCallback } from 'react';
import { airQualityAPI, sensorAPI, AirQualityData } from '@/lib/api';

// [demo-sensor]
const DEMO_SENSOR = { lat: 43.238, lng: 76.945, aqi: 42, name: "TynysAI Demo" };

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
  const { userId, refetchIntervalMs = 5000 } = options;
  const [sensors, setSensors] = useState<MapSensor[]>([]);
  const [allAirQuality, setAllAirQuality] = useState<AirQualityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Only log error once per error occurrence
  const lastErrorRef = React.useRef<string | null>(null);
  const consecutiveFailures = React.useRef(0);
  const refetch = useCallback(async () => {
    // Only show loading on the very first fetch (no data yet)
    if (sensors.length === 0 && allAirQuality.length === 0) {
      setLoading(true);
    }
    setError(null);
    try {
      // Загружаем данные из /api/map-data (реалтайм) и купленные/выданные датчики пользователя
      const [mapDataResponse, purchasedRawSensors] = await Promise.all([
        fetch('/api/map-data')
          .then(res => {
            if (!res.ok) {
              console.warn('[SensorsOnMap] API response not OK:', res.status, res.statusText);
              return null;
            }
            return res.json();
          })
          .then(data => {
            if (data?.success && Array.isArray(data.data)) {
              console.log('[SensorsOnMap] Received map-data:', data.data.length, 'items');
              return data.data;
            }
            console.warn('[SensorsOnMap] Invalid map-data format:', data);
            return [];
          })
          .catch((err) => {
            console.error('[SensorsOnMap] map-data fetch error:', err);
            return [];
          }),
        sensorAPI.mapSensors().catch((err) => {
          console.warn('[SensorsOnMap] mapSensors fetch error:', err?.message || err);
          return [];
        }),
      ]);

      // Преобразуем данные из /api/map-data в MapSensor
      // Показываем только данные от активного устройства
      const mapDataSensors: MapSensor[] = [];
      if (Array.isArray(mapDataResponse) && mapDataResponse.length > 0) {
        mapDataResponse.forEach((item: any, i: number) => {
          if (item?.location) {
            const [lat, lng] = item.location.split(',').map((v: string) => parseFloat(v.trim()));
            if (!isNaN(lat) && !isNaN(lng)) {
              const params = item.parameters || {};
              mapDataSensors.push({
                id: `map-data-${item.sensorId || i}`,
                lat,
                lng,
                aqi: item.value || 0,
                isPurchased: false,
                name: item.site || item.sensorId || 'Sensor',
                device_name: item.device_name,
                device_id: item.device_id || item.sensorId,
                label: item.label,
                site: item.site,
                city: 'Almaty',
                country: 'KZ',
                timestamp: item.timestamp,
                parameters: {
                  pm1: params.pm1 ?? 0,
                  pm25: params.pm25 ?? item.value ?? 0,
                  pm10: params.pm10 ?? 0,
                  co2: params.co2 ?? 0,
                  voc: params.voc ?? 0,
                  temp: params.temp ?? 0,
                  hum: params.hum ?? 0,
                  ch2o: params.ch2o ?? 0,
                  co: params.co ?? 0,
                  o3: params.o3 ?? 0,
                  no2: params.no2 ?? 0,
                },
              });
            } else {
              console.warn('[SensorsOnMap] Invalid coordinates:', item.location);
            }
          } else {
            console.warn('[SensorsOnMap] Missing location in item:', item);
          }
        });
      }

      const purchasedSensors = (Array.isArray(purchasedRawSensors) ? purchasedRawSensors : [])
        .map((sensor, i) => purchasedSensorToMapSensor(sensor, i))
        .filter((sensor): sensor is MapSensor => sensor !== null);

      const mergedSensors = applyFixedMarkerPositions([...purchasedSensors, ...mapDataSensors]);

      // [demo-sensor] Keep demo marker independent from API payloads.
      const demoSensor: MapSensor = {
        id: 'demo-tynysai-marker',
        lat: DEMO_SENSOR.lat,
        lng: DEMO_SENSOR.lng,
        aqi: DEMO_SENSOR.aqi,
        isPurchased: false,
        isDemo: true,
        name: DEMO_SENSOR.name,
        markerIndex: 0,
      };
      const mapSensorsWithDemo = [demoSensor, ...mergedSensors];

      console.log('[SensorsOnMap] Processed sensors:', mapSensorsWithDemo.length, mapSensorsWithDemo);

      setAllAirQuality([]);
      setSensors(mapSensorsWithDemo);
      
      if (mergedSensors.length === 0 && (mapDataResponse.length > 0 || purchasedSensors.length > 0)) {
        console.error('[SensorsOnMap] Failed to process sensors from response:', mapDataResponse);
      }
      lastErrorRef.current = null;
      consecutiveFailures.current = 0;
    } catch (e: any) {
      const errMsg = e?.message ?? 'Failed to load sensors';
      setError(errMsg);
      // Keep stale data on the map instead of blanking it
      consecutiveFailures.current += 1;
      if (lastErrorRef.current !== errMsg) {
        console.warn('[SensorsOnMap]', errMsg);
        lastErrorRef.current = errMsg;
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (refetchIntervalMs <= 0) return;
    // Back off on repeated failures: double the interval per failure, cap at 60 s
    const backoff = Math.min(
      refetchIntervalMs * Math.pow(2, consecutiveFailures.current),
      60_000
    );
    const interval = setInterval(refetch, backoff);
    return () => clearInterval(interval);
  }, [refetchIntervalMs, refetch, error]);

  return { sensors, allAirQuality, loading, isLoading: loading, error, refetch };
}
