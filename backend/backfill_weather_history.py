#!/usr/bin/env python3
"""Backfill one year of hourly weather history into MongoDB."""

from __future__ import annotations

import argparse
import asyncio
import os
from datetime import datetime, timezone

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from services.weather_service import get_weather_history


def location_key(lat: float, lon: float) -> str:
    return f"{float(lat):.4f},{float(lon):.4f}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill hourly weather_history rows.")
    parser.add_argument("--city", default="Almaty")
    parser.add_argument("--state", default="Almaty")
    parser.add_argument("--country", default="Kazakhstan")
    parser.add_argument("--lat", type=float, default=43.2220)
    parser.add_argument("--lon", type=float, default=76.8512)
    parser.add_argument("--days", type=int, default=365)
    parser.add_argument("--keep-existing", action="store_true")
    return parser.parse_args()


async def main() -> None:
    load_dotenv()
    args = parse_args()
    days = max(1, min(args.days, 366))
    mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    database_name = os.getenv("DATABASE_NAME", "breez")

    key = location_key(args.lat, args.lon)
    client = AsyncIOMotorClient(
        mongo_url,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=5000,
        socketTimeoutMS=5000,
    )
    try:
        await client.admin.command("ping")
        snapshots = await get_weather_history(args.lat, args.lon, days)
        if not snapshots:
            raise RuntimeError("Historical weather API returned no hourly rows")

        now = datetime.now(timezone.utc)
        docs = [
            {
                **snapshot,
                "city": args.city,
                "state": args.state,
                "country": args.country,
                "lat": args.lat,
                "lon": args.lon,
                "location_key": key,
                "created_at": now,
            }
            for snapshot in snapshots
        ]

        collection = client[database_name].weather_history
        deleted = 0
        if not args.keep_existing:
            result = await collection.delete_many({
                "location_key": key,
                "timestamp": {"$gte": docs[0]["timestamp"], "$lte": docs[-1]["timestamp"]},
            })
            deleted = result.deleted_count

        inserted = 0
        for start in range(0, len(docs), 1000):
            chunk = docs[start:start + 1000]
            result = await collection.insert_many(chunk)
            inserted += len(result.inserted_ids)

        print(
            f"weather_history backfilled: inserted={inserted}, deleted={deleted}, "
            f"location_key={key}, range={docs[0]['timestamp']}..{docs[-1]['timestamp']}"
        )
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
