'use client';

import React from 'react';
import { useEffect, useState, useCallback } from 'react';
import { sensorAPI } from '@/lib/api';
import type { MapSensor } from './useSensorsOnMap';

export type { MapSensor };

/**
 * Converts a raw sensor from the /sensors/map API to a MapSensor.
 * Only returns a valid MapSensor when lat/lng are present.
 */
function toMapSensor(s: any, index: number): MapSensor | null {
  const lat = s?.lat ?? s?.location?.coordinates?.[1];
  const lng = s?.lng ?? s?.location?.coordinates?.[0];
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return {
    id: `sensor-${s?.id ?? index}`,
    lat,
    lng,
    aqi: s?.aqi ?? 0,
    isPurchased: true,
    name: s?.name,
    city: s?.city,
    country: s?.country,
    description: s?.description,
    parameters: s?.parameters ?? {},
  };
}

export interface UseUserSensorsResult {
  sensors: MapSensor[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook that fetches ONLY the current user's sensors via /sensors/map.
 * No global / third-party air-quality data is included.
 *
 * Returns an empty array when the user is not logged in or has no sensors,
 * so the map renders as a clean Almaty base map with no markers.
 */
export function useUserSensors(
  options: {
    /** Pass the logged-in user's id. Null / undefined means not logged in. */
    userId?: string | null;
    /** Polling interval in ms. 0 to disable. Default 60000. */
    refetchIntervalMs?: number;
  } = {}
): UseUserSensorsResult {
  const { userId, refetchIntervalMs = 60_000 } = options;
  const [sensors, setSensors] = useState<MapSensor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const lastErrorRef = React.useRef<string | null>(null);
  const requestInFlightRef = React.useRef<Promise<void> | null>(null);
  const hasLoadedOnceRef = React.useRef(false);

  const refetch = useCallback(async () => {
    if (requestInFlightRef.current) {
      return requestInFlightRef.current;
    }

    const requestPromise = (async () => {
      // No user → no sensors to fetch
      if (!userId) {
        setSensors([]);
        hasLoadedOnceRef.current = true;
        setLoading(false);
        return;
      }

      // Only show loading spinner on the very first fetch
      if (!hasLoadedOnceRef.current) {
        setLoading(true);
      }
      setError(null);

      try {
        const raw = await sensorAPI.mapSensors();
        const list = Array.isArray(raw) ? raw : [];
        const mapped = list
          .map((s, i) => toMapSensor(s, i))
          .filter((s): s is MapSensor => s !== null);

        setSensors(mapped);
        lastErrorRef.current = null;
      } catch (e: any) {
        const errMsg = e?.message ?? 'Failed to load sensors';
        setError(errMsg);
        // Keep stale data visible instead of blanking the map
        if (lastErrorRef.current !== errMsg) {
          console.warn('[useUserSensors]', errMsg);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (!userId || refetchIntervalMs <= 0) return;
    const interval = setInterval(refetch, refetchIntervalMs);
    return () => clearInterval(interval);
  }, [userId, refetchIntervalMs, refetch]);

  return { sensors, loading, error, refetch };
}
