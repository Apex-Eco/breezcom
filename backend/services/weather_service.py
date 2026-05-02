from __future__ import annotations

import os
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List

import httpx


WEATHERAPI_BASE_URL = "https://api.weatherapi.com/v1"
OPEN_METEO_BASE_URL = "https://api.open-meteo.com/v1"
OPEN_METEO_ARCHIVE_BASE_URL = "https://archive-api.open-meteo.com/v1"
OPEN_METEO_WEATHER_FIELDS = (
    "temperature_2m,relative_humidity_2m,wind_speed_10m,pressure_msl,weather_code"
)


def _to_float(value: Any, fallback: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalized(
    provider: str,
    temperature: Any,
    humidity: Any,
    wind_speed: Any,
    pressure: Any,
    condition: str,
    timestamp: str | None = None,
) -> Dict[str, Any]:
    return {
        "provider": provider,
        "temperature": _to_float(temperature),
        "humidity": _to_float(humidity),
        "wind_speed": _to_float(wind_speed),
        "pressure": _to_float(pressure),
        "condition": condition or "Unknown",
        "timestamp": timestamp or _iso_now(),
    }


async def get_current_weather(lat: float, lon: float) -> Dict[str, Any]:
    api_key = os.getenv("WEATHERAPI_KEY", "").strip()
    if api_key:
        try:
            return await _weatherapi_current(lat, lon, api_key)
        except Exception as exc:
            print(f"WeatherAPI current failed, falling back to Open-Meteo: {exc}")
    return await _open_meteo_current(lat, lon)


async def get_weather_forecast(lat: float, lon: float) -> Dict[str, Any]:
    api_key = os.getenv("WEATHERAPI_KEY", "").strip()
    if api_key:
        try:
            return await _weatherapi_forecast(lat, lon, api_key)
        except Exception as exc:
            print(f"WeatherAPI forecast failed, falling back to Open-Meteo: {exc}")
    return await _open_meteo_forecast(lat, lon)


async def get_weather_history(
    lat: float,
    lon: float,
    days: int = 365,
    end_date: date | None = None,
) -> List[Dict[str, Any]]:
    days = max(1, min(days, 366))
    end = end_date or (datetime.now(timezone.utc).date() - timedelta(days=1))
    start = end - timedelta(days=days - 1)

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{OPEN_METEO_ARCHIVE_BASE_URL}/archive",
            params={
                "latitude": lat,
                "longitude": lon,
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
                "hourly": OPEN_METEO_WEATHER_FIELDS,
                "timezone": "auto",
            },
        )
        response.raise_for_status()
        payload = response.json()

    hourly = payload.get("hourly", {})
    times = hourly.get("time", [])
    history: List[Dict[str, Any]] = []
    for index, timestamp in enumerate(times):
        history.append(
            _normalized(
                "open-meteo-archive",
                _value_at(hourly, "temperature_2m", index),
                _value_at(hourly, "relative_humidity_2m", index),
                _value_at(hourly, "wind_speed_10m", index),
                _value_at(hourly, "pressure_msl", index),
                _open_meteo_condition(_value_at(hourly, "weather_code", index)),
                timestamp,
            )
        )
    return history


async def _weatherapi_current(lat: float, lon: float, api_key: str) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=8.0) as client:
        response = await client.get(
            f"{WEATHERAPI_BASE_URL}/current.json",
            params={"key": api_key, "q": f"{lat},{lon}", "aqi": "no"},
        )
        response.raise_for_status()
        payload = response.json()

    current = payload.get("current", {})
    condition = current.get("condition") or {}
    return _normalized(
        "weatherapi.com",
        current.get("temp_c"),
        current.get("humidity"),
        current.get("wind_kph"),
        current.get("pressure_mb"),
        condition.get("text", "Unknown"),
        current.get("last_updated_epoch")
        and datetime.fromtimestamp(current["last_updated_epoch"], timezone.utc).isoformat(),
    )


async def _weatherapi_forecast(lat: float, lon: float, api_key: str) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=8.0) as client:
        response = await client.get(
            f"{WEATHERAPI_BASE_URL}/forecast.json",
            params={"key": api_key, "q": f"{lat},{lon}", "days": 2, "aqi": "no"},
        )
        response.raise_for_status()
        payload = response.json()

    current = await _weatherapi_current(lat, lon, api_key)
    forecast: List[Dict[str, Any]] = []
    for day in payload.get("forecast", {}).get("forecastday", []):
        for hour in day.get("hour", []):
            forecast.append(
                _normalized(
                    "weatherapi.com",
                    hour.get("temp_c"),
                    hour.get("humidity"),
                    hour.get("wind_kph"),
                    hour.get("pressure_mb"),
                    (hour.get("condition") or {}).get("text", "Unknown"),
                    hour.get("time_epoch")
                    and datetime.fromtimestamp(hour["time_epoch"], timezone.utc).isoformat(),
                )
            )
    return {**current, "forecast": forecast[:24]}


async def _open_meteo_current(lat: float, lon: float) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=8.0) as client:
        response = await client.get(
            f"{OPEN_METEO_BASE_URL}/forecast",
            params={
                "latitude": lat,
                "longitude": lon,
                "current": "temperature_2m,relative_humidity_2m,wind_speed_10m,pressure_msl,weather_code",
                "timezone": "auto",
            },
        )
        response.raise_for_status()
        payload = response.json()

    current = payload.get("current", {})
    return _normalized(
        "open-meteo",
        current.get("temperature_2m"),
        current.get("relative_humidity_2m"),
        current.get("wind_speed_10m"),
        current.get("pressure_msl"),
        _open_meteo_condition(current.get("weather_code")),
        current.get("time"),
    )


async def _open_meteo_forecast(lat: float, lon: float) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=8.0) as client:
        response = await client.get(
            f"{OPEN_METEO_BASE_URL}/forecast",
            params={
                "latitude": lat,
                "longitude": lon,
                "hourly": "temperature_2m,relative_humidity_2m,wind_speed_10m,pressure_msl,weather_code",
                "current": "temperature_2m,relative_humidity_2m,wind_speed_10m,pressure_msl,weather_code",
                "forecast_days": 2,
                "timezone": "auto",
            },
        )
        response.raise_for_status()
        payload = response.json()

    current = payload.get("current", {})
    hourly = payload.get("hourly", {})
    times = hourly.get("time", [])
    forecast = []
    for index, timestamp in enumerate(times[:24]):
        forecast.append(
            _normalized(
                "open-meteo",
                _value_at(hourly, "temperature_2m", index),
                _value_at(hourly, "relative_humidity_2m", index),
                _value_at(hourly, "wind_speed_10m", index),
                _value_at(hourly, "pressure_msl", index),
                _open_meteo_condition(_value_at(hourly, "weather_code", index)),
                timestamp,
            )
        )

    return {
        **_normalized(
            "open-meteo",
            current.get("temperature_2m"),
            current.get("relative_humidity_2m"),
            current.get("wind_speed_10m"),
            current.get("pressure_msl"),
            _open_meteo_condition(current.get("weather_code")),
            current.get("time"),
        ),
        "forecast": forecast,
    }


def _value_at(payload: Dict[str, List[Any]], key: str, index: int) -> Any:
    values = payload.get(key, [])
    return values[index] if index < len(values) else None


def _open_meteo_condition(code: Any) -> str:
    try:
        weather_code = int(code)
    except (TypeError, ValueError):
        return "Unknown"

    if weather_code == 0:
        return "Clear"
    if weather_code in {1, 2, 3}:
        return "Partly cloudy"
    if weather_code in {45, 48}:
        return "Fog"
    if weather_code in {51, 53, 55, 56, 57}:
        return "Drizzle"
    if weather_code in {61, 63, 65, 66, 67, 80, 81, 82}:
        return "Rain"
    if weather_code in {71, 73, 75, 77, 85, 86}:
        return "Snow"
    if weather_code in {95, 96, 99}:
        return "Thunderstorm"
    return "Cloudy"
