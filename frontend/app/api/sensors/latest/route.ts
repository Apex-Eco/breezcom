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

type LatestSensorPoint = {
  id: string;
  lat: number;
  lng: number;
  pm25: number;
  timestamp: string;
  site: string;
};

const TYNYS_SENSOR_FALLBACK: Array<Omit<LatestSensorPoint, "timestamp">> = [
  { id: "TY-01", lat: 43.216124, lng: 76.880444, pm25: 18, site: "Microdistrict 1" },
  { id: "TY-02", lat: 43.21825, lng: 76.920739, pm25: 24, site: "Microdistrict 2" },
  { id: "TY-03", lat: 43.233797, lng: 76.761204, pm25: 31, site: "Alatau District" },
  { id: "TY-04", lat: 43.223431, lng: 76.901261, pm25: 28, site: "Seifullin Ave" },
  { id: "TY-05", lat: 43.245644, lng: 76.889126, pm25: 35, site: "Dostyk Plaza area" },
  { id: "TY-06", lat: 43.264688, lng: 76.918148, pm25: 42, site: "Raimbek Ave" },
  { id: "TY-07", lat: 43.246987, lng: 76.958445, pm25: 38, site: "Shugyla District" },
  { id: "TY-08", lat: 43.254494, lng: 76.953902, pm25: 47, site: "East Industrial" },
  { id: "TY-09", lat: 43.369441, lng: 77.310747, pm25: 22, site: "Talgar Checkpoint" },
  { id: "TY-10", lat: 43.225782, lng: 76.930466, pm25: 29, site: "Almaly District" },
  { id: "TY-11", lat: 43.230413, lng: 76.910433, pm25: 27, site: "Bostandyk Centre" },
  { id: "TY-12", lat: 43.256511, lng: 76.826015, pm25: 33, site: "Navruz Park area" },
  { id: "TY-13", lat: 43.216466, lng: 76.776729, pm25: 36, site: "Auezov District" },
  { id: "TY-14", lat: 43.344326, lng: 76.914315, pm25: 41, site: "Turksib District" },
  { id: "TY-15", lat: 43.21086, lng: 76.861406, pm25: 44, site: "Airport Road" },
  { id: "TY-16", lat: 43.229065, lng: 76.933489, pm25: 16, site: "Medeu Foothills" },
  { id: "TY-17", lat: 43.22676, lng: 76.910461, pm25: 21, site: "Central Park" },
  { id: "TY-18", lat: 43.23259, lng: 76.88285, pm25: 25, site: "Panfilov Park" },
  { id: "TY-19", lat: 43.224489, lng: 76.923981, pm25: 39, site: "Green Bazaar area" },
  { id: "TY-20", lat: 43.236987, lng: 76.934981, pm25: 32, site: "Esentai Mall area" },
];

function fallbackSensors(): LatestSensorPoint[] {
  const timestamp = new Date().toISOString();
  return TYNYS_SENSOR_FALLBACK.map((sensor) => ({ ...sensor, timestamp }));
}

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
      const fallback = fallbackSensors();
      return NextResponse.json({ success: true, data: fallback, count: fallback.length });
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

    if (data.length === 0) {
      const fallback = fallbackSensors();
      return NextResponse.json({ success: true, data: fallback, count: fallback.length });
    }

    return NextResponse.json({ success: true, data, count: data.length });
  } catch (error) {
    console.warn(
      "sensors/latest: failed to fetch map data, returning fallback locations.",
      error instanceof Error ? error.message : error
    );

    const fallback = fallbackSensors();
    return NextResponse.json({ success: true, data: fallback, count: fallback.length });
  }
}
