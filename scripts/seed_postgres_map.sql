INSERT INTO sites (site_name, city, country, created_at, updated_at)
VALUES
  ('Microdistrict 1', 'Almaty', 'KZ', NOW(), NOW()),
  ('Microdistrict 2', 'Almaty', 'KZ', NOW(), NOW()),
  ('Alatau District', 'Almaty', 'KZ', NOW(), NOW()),
  ('Seifullin Ave', 'Almaty', 'KZ', NOW(), NOW()),
  ('Dostyk Plaza area', 'Almaty', 'KZ', NOW(), NOW()),
  ('Raimbek Ave', 'Almaty', 'KZ', NOW(), NOW()),
  ('Shugyla District', 'Almaty', 'KZ', NOW(), NOW()),
  ('East Industrial', 'Almaty', 'KZ', NOW(), NOW()),
  ('Talgar Checkpoint', 'Almaty', 'KZ', NOW(), NOW()),
  ('Almaly District', 'Almaty', 'KZ', NOW(), NOW()),
  ('Bostandyk Centre', 'Almaty', 'KZ', NOW(), NOW()),
  ('Navruz Park area', 'Almaty', 'KZ', NOW(), NOW()),
  ('Auezov District', 'Almaty', 'KZ', NOW(), NOW()),
  ('Turksib District', 'Almaty', 'KZ', NOW(), NOW()),
  ('Airport Road', 'Almaty', 'KZ', NOW(), NOW()),
  ('Medeu Foothills', 'Almaty', 'KZ', NOW(), NOW()),
  ('Central Park', 'Almaty', 'KZ', NOW(), NOW()),
  ('Panfilov Park', 'Almaty', 'KZ', NOW(), NOW()),
  ('Green Bazaar area', 'Almaty', 'KZ', NOW(), NOW()),
  ('Esentai Mall area', 'Almaty', 'KZ', NOW(), NOW())
ON CONFLICT DO NOTHING;

INSERT INTO sensors (
  device_id,
  site_id,
  sensor_type,
  firmware_version,
  latitude,
  longitude,
  environment_type,
  is_active,
  created_at,
  updated_at
)
SELECT
  seed.device_id,
  st.site_id,
  'air_quality',
  'demo-map-v1',
  seed.latitude,
  seed.longitude,
  'urban',
  true,
  NOW(),
  NOW()
FROM (
  VALUES
    ('TY-01', 'Microdistrict 1', 43.216124::double precision, 76.880444::double precision),
    ('TY-02', 'Microdistrict 2', 43.218250::double precision, 76.920739::double precision),
    ('TY-03', 'Alatau District', 43.233797::double precision, 76.761204::double precision),
    ('TY-04', 'Seifullin Ave', 43.223431::double precision, 76.901261::double precision),
    ('TY-05', 'Dostyk Plaza area', 43.245644::double precision, 76.889126::double precision),
    ('TY-06', 'Raimbek Ave', 43.264688::double precision, 76.918148::double precision),
    ('TY-07', 'Shugyla District', 43.246987::double precision, 76.958445::double precision),
    ('TY-08', 'East Industrial', 43.254494::double precision, 76.953902::double precision),
    ('TY-09', 'Talgar Checkpoint', 43.369441::double precision, 77.310747::double precision),
    ('TY-10', 'Almaly District', 43.225782::double precision, 76.930466::double precision),
    ('TY-11', 'Bostandyk Centre', 43.230413::double precision, 76.910433::double precision),
    ('TY-12', 'Navruz Park area', 43.256511::double precision, 76.826015::double precision),
    ('TY-13', 'Auezov District', 43.216466::double precision, 76.776729::double precision),
    ('TY-14', 'Turksib District', 43.344326::double precision, 76.914315::double precision),
    ('TY-15', 'Airport Road', 43.210860::double precision, 76.861406::double precision),
    ('TY-16', 'Medeu Foothills', 43.229065::double precision, 76.933489::double precision),
    ('TY-17', 'Central Park', 43.226760::double precision, 76.910461::double precision),
    ('TY-18', 'Panfilov Park', 43.232590::double precision, 76.882850::double precision),
    ('TY-19', 'Green Bazaar area', 43.224489::double precision, 76.923981::double precision),
    ('TY-20', 'Esentai Mall area', 43.236987::double precision, 76.934981::double precision)
) AS seed(device_id, site_name, latitude, longitude)
INNER JOIN sites st ON st.site_name = seed.site_name
ON CONFLICT (device_id) DO UPDATE
SET
  site_id = EXCLUDED.site_id,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  firmware_version = EXCLUDED.firmware_version,
  is_active = true,
  updated_at = NOW();

INSERT INTO sensor_readings (
  sensor_id,
  timestamp,
  server_received_at,
  pm1,
  pm25,
  pm10,
  co2,
  co,
  o3,
  no2,
  voc,
  ch2o,
  temperature,
  humidity,
  pressure,
  data_quality_score,
  value,
  location,
  transport_type,
  ingested_at,
  data_hash
)
SELECT
  s.sensor_id,
  NOW() - seed.minute_offset * INTERVAL '1 minute',
  NOW(),
  seed.pm1,
  seed.pm25,
  seed.pm10,
  seed.co2,
  seed.co,
  seed.o3,
  seed.no2,
  seed.voc,
  seed.ch2o,
  seed.temperature,
  seed.humidity,
  seed.pressure,
  0.98,
  seed.pm25,
  CONCAT(seed.latitude, ',', seed.longitude),
  'fixed',
  NOW(),
  CONCAT(seed.device_id, '-', TO_CHAR(CURRENT_DATE, 'YYYYMMDD'))
FROM (
  VALUES
    ('TY-01', 3, 12.0::double precision, 18.0::double precision, 24.0::double precision, 410.0::double precision, 0.20::double precision, 26.0::double precision, 14.0::double precision, 0.12::double precision, 0.004::double precision, 19.0::double precision, 48.0::double precision, 1014.0::double precision, 43.216124::double precision, 76.880444::double precision),
    ('TY-02', 6, 15.0::double precision, 24.0::double precision, 32.0::double precision, 422.0::double precision, 0.25::double precision, 29.0::double precision, 18.0::double precision, 0.16::double precision, 0.005::double precision, 20.0::double precision, 45.0::double precision, 1013.0::double precision, 43.218250::double precision, 76.920739::double precision),
    ('TY-03', 9, 19.0::double precision, 31.0::double precision, 40.0::double precision, 434.0::double precision, 0.32::double precision, 33.0::double precision, 20.0::double precision, 0.18::double precision, 0.006::double precision, 21.0::double precision, 43.0::double precision, 1012.0::double precision, 43.233797::double precision, 76.761204::double precision),
    ('TY-04', 12, 17.0::double precision, 28.0::double precision, 36.0::double precision, 426.0::double precision, 0.28::double precision, 31.0::double precision, 19.0::double precision, 0.17::double precision, 0.005::double precision, 20.0::double precision, 46.0::double precision, 1013.0::double precision, 43.223431::double precision, 76.901261::double precision),
    ('TY-05', 15, 21.0::double precision, 35.0::double precision, 47.0::double precision, 441.0::double precision, 0.36::double precision, 36.0::double precision, 23.0::double precision, 0.22::double precision, 0.007::double precision, 22.0::double precision, 42.0::double precision, 1011.0::double precision, 43.245644::double precision, 76.889126::double precision),
    ('TY-06', 18, 24.0::double precision, 42.0::double precision, 56.0::double precision, 455.0::double precision, 0.41::double precision, 39.0::double precision, 26.0::double precision, 0.26::double precision, 0.008::double precision, 23.0::double precision, 40.0::double precision, 1010.0::double precision, 43.264688::double precision, 76.918148::double precision),
    ('TY-07', 21, 22.0::double precision, 38.0::double precision, 50.0::double precision, 448.0::double precision, 0.38::double precision, 37.0::double precision, 24.0::double precision, 0.23::double precision, 0.007::double precision, 22.0::double precision, 41.0::double precision, 1011.0::double precision, 43.246987::double precision, 76.958445::double precision),
    ('TY-08', 24, 27.0::double precision, 47.0::double precision, 62.0::double precision, 466.0::double precision, 0.49::double precision, 43.0::double precision, 29.0::double precision, 0.31::double precision, 0.010::double precision, 24.0::double precision, 38.0::double precision, 1009.0::double precision, 43.254494::double precision, 76.953902::double precision),
    ('TY-09', 27, 14.0::double precision, 22.0::double precision, 29.0::double precision, 405.0::double precision, 0.18::double precision, 24.0::double precision, 12.0::double precision, 0.10::double precision, 0.003::double precision, 17.0::double precision, 50.0::double precision, 1015.0::double precision, 43.369441::double precision, 77.310747::double precision),
    ('TY-10', 30, 18.0::double precision, 29.0::double precision, 39.0::double precision, 430.0::double precision, 0.30::double precision, 32.0::double precision, 21.0::double precision, 0.19::double precision, 0.006::double precision, 21.0::double precision, 44.0::double precision, 1012.0::double precision, 43.225782::double precision, 76.930466::double precision),
    ('TY-11', 33, 16.0::double precision, 27.0::double precision, 35.0::double precision, 424.0::double precision, 0.26::double precision, 30.0::double precision, 18.0::double precision, 0.16::double precision, 0.005::double precision, 20.0::double precision, 45.0::double precision, 1013.0::double precision, 43.230413::double precision, 76.910433::double precision),
    ('TY-12', 36, 20.0::double precision, 33.0::double precision, 44.0::double precision, 438.0::double precision, 0.33::double precision, 34.0::double precision, 22.0::double precision, 0.20::double precision, 0.006::double precision, 21.0::double precision, 43.0::double precision, 1012.0::double precision, 43.256511::double precision, 76.826015::double precision),
    ('TY-13', 39, 23.0::double precision, 36.0::double precision, 48.0::double precision, 446.0::double precision, 0.37::double precision, 35.0::double precision, 24.0::double precision, 0.22::double precision, 0.007::double precision, 22.0::double precision, 42.0::double precision, 1011.0::double precision, 43.216466::double precision, 76.776729::double precision),
    ('TY-14', 42, 25.0::double precision, 41.0::double precision, 54.0::double precision, 452.0::double precision, 0.42::double precision, 38.0::double precision, 27.0::double precision, 0.27::double precision, 0.009::double precision, 23.0::double precision, 39.0::double precision, 1010.0::double precision, 43.344326::double precision, 76.914315::double precision),
    ('TY-15', 45, 26.0::double precision, 44.0::double precision, 58.0::double precision, 460.0::double precision, 0.46::double precision, 41.0::double precision, 28.0::double precision, 0.29::double precision, 0.009::double precision, 24.0::double precision, 37.0::double precision, 1009.0::double precision, 43.210860::double precision, 76.861406::double precision),
    ('TY-16', 48, 11.0::double precision, 16.0::double precision, 22.0::double precision, 398.0::double precision, 0.14::double precision, 23.0::double precision, 11.0::double precision, 0.09::double precision, 0.003::double precision, 18.0::double precision, 52.0::double precision, 1015.0::double precision, 43.229065::double precision, 76.933489::double precision),
    ('TY-17', 51, 13.0::double precision, 21.0::double precision, 28.0::double precision, 408.0::double precision, 0.17::double precision, 25.0::double precision, 13.0::double precision, 0.11::double precision, 0.004::double precision, 19.0::double precision, 49.0::double precision, 1014.0::double precision, 43.226760::double precision, 76.910461::double precision),
    ('TY-18', 54, 15.0::double precision, 25.0::double precision, 33.0::double precision, 418.0::double precision, 0.22::double precision, 28.0::double precision, 16.0::double precision, 0.14::double precision, 0.004::double precision, 20.0::double precision, 47.0::double precision, 1013.0::double precision, 43.232590::double precision, 76.882850::double precision),
    ('TY-19', 57, 22.0::double precision, 39.0::double precision, 51.0::double precision, 447.0::double precision, 0.39::double precision, 37.0::double precision, 25.0::double precision, 0.24::double precision, 0.008::double precision, 22.0::double precision, 41.0::double precision, 1011.0::double precision, 43.224489::double precision, 76.923981::double precision),
    ('TY-20', 59, 19.0::double precision, 32.0::double precision, 43.0::double precision, 436.0::double precision, 0.31::double precision, 33.0::double precision, 21.0::double precision, 0.19::double precision, 0.006::double precision, 21.0::double precision, 43.0::double precision, 1012.0::double precision, 43.236987::double precision, 76.934981::double precision)
) AS seed(
  device_id,
  minute_offset,
  pm1,
  pm25,
  pm10,
  co2,
  co,
  o3,
  no2,
  voc,
  ch2o,
  temperature,
  humidity,
  pressure,
  latitude,
  longitude
)
INNER JOIN sensors s ON s.device_id = seed.device_id
WHERE NOT EXISTS (
  SELECT 1
  FROM sensor_readings sr
  WHERE sr.sensor_id = s.sensor_id
    AND sr.data_hash = CONCAT(seed.device_id, '-', TO_CHAR(CURRENT_DATE, 'YYYYMMDD'))
);
