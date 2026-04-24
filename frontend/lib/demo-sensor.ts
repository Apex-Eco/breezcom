export type DemoSensorPayload = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  aqi: number;
  city: string;
  country: string;
  timestamp: string;
  parameters: {
    pm1: number;
    pm25: number;
    pm10: number;
    co2: number;
    voc: number;
    temp: number;
    hum: number;
    ch2o: number;
    co: number;
    o3: number;
    no2: number;
  };
};

function mulberry32(seed: number) {
  let value = seed;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function minuteSeed(now: Date): number {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const d = now.getUTCDate();
  const h = now.getUTCHours();
  const min = now.getUTCMinutes();
  return y * 100000000 + m * 1000000 + d * 10000 + h * 100 + min;
}

export function buildDemoSensor(now: Date = new Date()): DemoSensorPayload {
  const rng = mulberry32(minuteSeed(now));
  const minuteTimestamp = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      now.getUTCMinutes(),
      0,
      0
    )
  );

  const aqi = Math.round(38 + rng() * 42);
  const pm25 = Number((aqi * (0.42 + rng() * 0.12)).toFixed(1));
  const pm1 = Number((pm25 * (0.48 + rng() * 0.1)).toFixed(1));
  const pm10 = Number((pm25 * (1.24 + rng() * 0.22)).toFixed(1));
  const temp = Number((18 + rng() * 10).toFixed(1));
  const hum = Number((34 + rng() * 30).toFixed(0));

  return {
    id: 'demo-tynysai-marker',
    name: 'Almaty',
    lat: 43.238,
    lng: 76.945,
    aqi,
    city: 'Almaty',
    country: 'KZ',
    timestamp: minuteTimestamp.toISOString(),
    parameters: {
      pm1,
      pm25,
      pm10,
      co2: Number((420 + rng() * 180).toFixed(0)),
      voc: Number((0.18 + rng() * 0.42).toFixed(2)),
      temp,
      hum,
      ch2o: Number((0.01 + rng() * 0.04).toFixed(2)),
      co: Number((0.04 + rng() * 0.16).toFixed(2)),
      o3: Number((14 + rng() * 18).toFixed(1)),
      no2: Number((9 + rng() * 15).toFixed(1)),
    },
  };
}
