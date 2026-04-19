import { NextRequest, NextResponse } from "next/server";

type MapDataRow = {
  sensorId?: string;
  location?: string;
  value?: number;
  timestamp?: string;
  site?: string;
  parameters?: {
    pm25?: number;
  };
};

function parseLocation(location?: string): { lat: number; lng: number } | null {
  if (!location) return null;
  const [latRaw, lngRaw] = location.split(",").map((part) => Number(part.trim()));
  if (!Number.isFinite(latRaw) || !Number.isFinite(lngRaw)) return null;
  if (Math.abs(latRaw) > 90 || Math.abs(lngRaw) > 180) return null;
  return { lat: latRaw, lng: lngRaw };
}

export async function GET(request: NextRequest) {
  try {
    const mapDataUrl = new URL("/api/map-data", request.url);
    const mapDataResponse = await fetch(mapDataUrl.toString(), { cache: "no-store" });

    if (!mapDataResponse.ok) {
      return NextResponse.json({ success: true, data: [], count: 0 });
    }

    const payload = await mapDataResponse.json();
    const rows: MapDataRow[] = Array.isArray(payload?.data) ? payload.data : [];

    const data = rows
      .map((row, index) => {
        const coords = parseLocation(row.location);
        if (!coords) return null;

        const pm25Value = Number(row.parameters?.pm25 ?? row.value ?? 0);

        return {
          id: row.sensorId ?? `sensor-${index}`,
          lat: coords.lat,
          lng: coords.lng,
          pm25: Number.isFinite(pm25Value) ? pm25Value : 0,
          timestamp: row.timestamp ?? new Date().toISOString(),
          site: row.site ?? null,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return NextResponse.json({ success: true, data, count: data.length });
  } catch (error) {
    console.warn(
      "sensors/latest: failed to fetch map data, returning empty list.",
      error instanceof Error ? error.message : error
    );

    return NextResponse.json({ success: true, data: [], count: 0 });
  }
}
