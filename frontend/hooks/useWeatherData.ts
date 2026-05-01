"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

export interface WeatherData {
  temp_c: number;
  feels_like_c: number;
  humidity: number;
  wind_kph: number;
  wind_dir: string;
  condition_text: string;
  condition_icon: string;
  uv: number;
  pressure_mb: number;
  aqi_pm25: number | null;
  aqi_pm10: number | null;
  epa_index: number | null;
}

type WeatherHookState = {
  data: WeatherData | null;
  loading: boolean;
  error: string | null;
};

type WeatherCacheEntry = {
  data: WeatherData;
  timestamp: number;
};

const WEATHER_CACHE_TTL_MS = 10 * 60 * 1000;
const weatherCache = new Map<string, WeatherCacheEntry>();

function buildWeatherUrl(lat: number, lng: number): string {
  const url = new URL("/api/weather", API_URL);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lng", String(lng));
  return url.toString();
}

function getCachedWeather(cacheKey: string): WeatherData | null {
  const entry = weatherCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > WEATHER_CACHE_TTL_MS) {
    weatherCache.delete(cacheKey);
    return null;
  }
  return entry.data;
}

function setCachedWeather(cacheKey: string, data: WeatherData): void {
  weatherCache.set(cacheKey, { data, timestamp: Date.now() });
}

export function useWeatherData(lat: number, lng: number, enabled: boolean) {
  const [state, setState] = useState<WeatherHookState>({
    data: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    if (!enabled) {
      setState({ data: null, loading: false, error: null });
      return () => {
        cancelled = true;
      };
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setState({
        data: null,
        loading: false,
        error: "Invalid coordinates",
      });
      return () => {
        cancelled = true;
      };
    }

    const cacheKey = `${lat},${lng}`;
    const cached = getCachedWeather(cacheKey);
    if (cached) {
      setState({ data: cached, loading: false, error: null });
      return () => {
        cancelled = true;
      };
    }

    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: null }));

    void (async () => {
      try {
        const response = await fetch(buildWeatherUrl(lat, lng), {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Weather fetch failed");
        }

        const payload = (await response.json()) as WeatherData;
        if (!cancelled) {
          setCachedWeather(cacheKey, payload);
          setState({ data: payload, loading: false, error: null });
        }
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }

        const message = error instanceof Error ? error.message : "Weather fetch failed";
        setState({
          data: null,
          loading: false,
          error: message,
        });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled, lat, lng]);

  return state;
}
