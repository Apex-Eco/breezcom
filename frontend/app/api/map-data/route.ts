import { NextResponse } from 'next/server';
import postgres from 'postgres';

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
      data: Record<string, unknown>;
      device_id_full?: string | null;
    };
    
    // Получаем последнюю запись от каждого устройства
    // Сначала пробуем свежие данные (за последний час), если нет — берём последнюю запись вообще
    const freshReadings = await sql<ReadingRow[]>`
      SELECT 
        r.id,
        r.device_id,
        r.ts,
        r.data,
        d.id as device_id_full
      FROM readings r
      LEFT JOIN devices d ON r.device_id = d.id
      WHERE r.ts > NOW() - INTERVAL '1 hour'
      ORDER BY r.ts DESC
      LIMIT 10
    `;
    let readings: ReadingRow[] = Array.from(freshReadings as unknown as ReadingRow[]);

    // Если нет свежих данных — берём последнюю запись от каждого устройства
    if (readings.length === 0) {
      const fallbackReadings = await sql<ReadingRow[]>`
        SELECT DISTINCT ON (r.device_id)
          r.id,
          r.device_id,
          r.ts,
          r.data,
          d.id as device_id_full
        FROM readings r
        LEFT JOIN devices d ON r.device_id = d.id
        ORDER BY r.device_id, r.ts DESC
        LIMIT 10
      `;
      readings = Array.from(fallbackReadings as unknown as ReadingRow[]);
    }

    // Дедупликация — оставляем только последнюю запись от каждого устройства
    const latestByDevice = new Map<string, ReadingRow>();
    for (const r of readings) {
      const did = r.device_id;
      if (!latestByDevice.has(did)) {
        latestByDevice.set(did, r);
      }
    }
    readings = Array.from(latestByDevice.values());

    // Маппинг сайтов на координаты
    const siteCoordinates: Record<string, string> = {
      'AGI_Lab': '43.2220,76.8512', // Алматы, центр города
      'Almaty': '43.2220,76.8512',
      'Алматы': '43.2220,76.8512',
    };

    // Преобразуем данные в формат MapReading
    const mapReadings = readings.map((reading) => {
      const data = reading.data || {};
      const site = typeof data.site === 'string' ? data.site : '';
      
      // Определяем координаты по сайту или используем дефолтные
      const location = siteCoordinates[site] || '43.2220,76.8512';
      
      // Извлекаем все параметры сенсора
      const num = (v: unknown) => (typeof v === 'number' ? v : 0);
      const pm25 = num(data.pm25) || num(data.pm2_5);
      
      return {
        location,
        value: pm25,
        timestamp: reading.ts.toISOString(),
        sensorId: reading.device_id || 'unknown',
        site: site || undefined,
        parameters: {
          pm1: num(data.pm1),
          pm25,
          pm10: num(data.pm10),
          co2: num(data.co2),
          voc: num(data.voc),
          temp: num(data.temp),
          hum: num(data.hum),
          ch2o: num(data.ch2o),
          co: num(data.co),
          o3: num(data.o3),
          no2: num(data.no2),
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
    // If the Postgres DB is unreachable, return empty data instead of 500
    // so the frontend can still show sensors from the backend API
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
