"use client";

import dynamic from "next/dynamic";
import type { MapReading } from "@/types/map-reading";

type AirQualityMapProps = {
  readings: MapReading[];
  emptyStateText: string;
  heightClass?: string;
  className?: string;
};

const AirQualityMap = dynamic<AirQualityMapProps>(
  () => import("@/components/air-quality-map").then((mod) => mod.AirQualityMap),
  { ssr: false }
);

export function MapPanel({
  readings,
  emptyMapText,
}: {
  readings: MapReading[];
  emptyMapText: string;
}) {
  return (
    <section className="relative rounded-2xl border border-green-500/30 bg-black/40 shadow-xl">
      <div className="space-y-3">
        <div className="flex items-center px-4 pt-3">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200/70">
            Live Air Quality Map
          </div>
        </div>

        <div className="relative">
          <div className="rounded-2xl border border-green-500/20 bg-surface">
            <AirQualityMap
              readings={readings}
              emptyStateText={emptyMapText}
              heightClass="h-[70vh]"
              className="rounded-2xl"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
