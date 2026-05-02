import { NextResponse } from 'next/server';
import postgres from 'postgres';

export const dynamic = 'force-dynamic';

const normalizePostgresUrl = (value: string): string =>
  value
    .replace(/^postgresql\+asyncpg:\/\//, 'postgresql://')
    .replace(/^postgres\+asyncpg:\/\//, 'postgres://');

// Подключение к базе данных data-tynys-postgres-1
const getDbConnection = () => {
  const directUrl =
    process.env.TYNYS_DB_URL ||
    process.env.DB_URL ||
    process.env.DATABASE_URL;

  if (directUrl) {
    return postgres(normalizePostgresUrl(directUrl), { max: 1 });
  }

  // По умолчанию используем localhost, так как приложение работает на хосте
  const dbHost = process.env.TYNYS_DB_HOST || process.env.PGHOST || process.env.POSTGRES_HOST || '127.0.0.1';
  const dbPort = process.env.TYNYS_DB_PORT || process.env.PGPORT || process.env.POSTGRES_PORT || '5432';
  const dbUser = process.env.TYNYS_DB_USER || process.env.PGUSER || process.env.POSTGRES_USER || 'iqair_user';
  const dbPassword = process.env.TYNYS_DB_PASSWORD || process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || 'zwNxu4QJzMc35yN2';
  const dbName = process.env.TYNYS_DB_NAME || process.env.PGDATABASE || process.env.POSTGRES_DB || 'iqair';

  const dbUrl = `postgresql://${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}`;
  return postgres(dbUrl, { max: 1 });
};

export async function GET() {
  let sql: ReturnType<typeof getDbConnection> | null = null;
  try {
    sql = getDbConnection();

    type ReadingRow = {
      id: number;
      device_id: string;
      ts: Date;
      site: string | null;
      latitude: number | null;
      longitude: number | null;
      pm1: number | null;
      pm25: number | null;
      pm10: number | null;
      co2: number | null;
      voc: number | null;
      temp: number | null;
      hum: number | null;
      ch2o: number | null;
      co: number | null;
      o3: number | null;
      no2: number | null;
    };

    const freshReadings = await sql<ReadingRow[]>`
      SELECT DISTINCT ON (s.device_id)
        sr.reading_id AS id,
        s.device_id,
        sr.timestamp AS ts,
        st.site_name AS site,
        s.latitude,
        s.longitude,
        sr.pm1,
        sr.pm25,
        sr.pm10,
        sr.co2,
        sr.voc,
        sr.temperature AS temp,
        sr.humidity AS hum,
        sr.ch2o,
        sr.co,
        sr.o3,
        sr.no2
      FROM sensor_readings sr
      INNER JOIN sensors s ON sr.sensor_id = s.sensor_id
      LEFT JOIN sites st ON s.site_id = st.site_id
      WHERE s.is_active = true
        AND sr.timestamp > NOW() - INTERVAL '1 hour'
      ORDER BY s.device_id, sr.timestamp DESC
      LIMIT 20
    `;
    let readings: ReadingRow[] = Array.from(freshReadings as unknown as ReadingRow[]);

    if (readings.length === 0) {
      const fallbackReadings = await sql<ReadingRow[]>`
        SELECT DISTINCT ON (s.device_id)
          sr.reading_id AS id,
          s.device_id,
          sr.timestamp AS ts,
          st.site_name AS site,
          s.latitude,
          s.longitude,
          sr.pm1,
          sr.pm25,
          sr.pm10,
          sr.co2,
          sr.voc,
          sr.temperature AS temp,
          sr.humidity AS hum,
          sr.ch2o,
          sr.co,
          sr.o3,
          sr.no2
        FROM sensor_readings sr
        INNER JOIN sensors s ON sr.sensor_id = s.sensor_id
        LEFT JOIN sites st ON s.site_id = st.site_id
        WHERE s.is_active = true
        ORDER BY s.device_id, sr.timestamp DESC
        LIMIT 20
      `;
      readings = Array.from(fallbackReadings as unknown as ReadingRow[]);
    }

    const latestByDevice = new Map<string, ReadingRow>();
    for (const r of readings) {
      const did = r.device_id;
      if (!latestByDevice.has(did)) {
        latestByDevice.set(did, r);
      }
    }
    readings = Array.from(latestByDevice.values());

    const siteCoordinates: Record<string, string> = {
      'AGI_Lab': '43.2220,76.8512', // Алматы, центр города
      'Almaty': '43.2220,76.8512',
      'Алматы': '43.2220,76.8512',
    };

    const mapReadings = readings.map((reading) => {
      const site = reading.site || '';
      const hasCoords =
        typeof reading.latitude === 'number' &&
        Number.isFinite(reading.latitude) &&
        typeof reading.longitude === 'number' &&
        Number.isFinite(reading.longitude);
      const location = hasCoords
        ? `${reading.latitude},${reading.longitude}`
        : (siteCoordinates[site] || '43.2220,76.8512');
      const num = (v: number | null | undefined) => (typeof v === 'number' ? v : 0);
      const pm25 = num(reading.pm25);

      return {
        location,
        value: pm25,
        timestamp: reading.ts.toISOString(),
        sensorId: reading.device_id || 'unknown',
        site: site || undefined,
        parameters: {
          pm1: num(reading.pm1),
          pm25,
          pm10: num(reading.pm10),
          co2: num(reading.co2),
          voc: num(reading.voc),
          temp: num(reading.temp),
          hum: num(reading.hum),
          ch2o: num(reading.ch2o),
          co: num(reading.co),
          o3: num(reading.o3),
          no2: num(reading.no2),
        },
      };
    });

    await sql.end();

    return NextResponse.json({
      success: true,
      data: mapReadings,
      count: mapReadings.length,
    });
  } catch (error) {
    console.warn('map-data: Postgres unavailable, returning empty data.', 
      error instanceof Error ? error.message : error);
    try { if (sql) await sql.end(); } catch { /* ignore cleanup error */ }
    return NextResponse.json({
      success: true,
      data: [],
      count: 0,
    });
  }
}
