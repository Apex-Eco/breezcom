/**
 * AQI category and styling for map markers and filters.
 * Pure helpers for consistent UI and filtering.
 */

export type AqiCategoryKey =
  | 'good'
  | 'moderate'
  | 'unhealthySensitive'
  | 'unhealthy'
  | 'veryUnhealthy';

export type SensorFilterValue = 'all' | AqiCategoryKey;

export interface AqiCategory {
  key: AqiCategoryKey;
  label: string;
  color: string;
  /** Text color for contrast on the category background */
  textColor: string;
  /** Tailwind ring/glow class (e.g. ring-green-500/60) */
  ringClass: string;
  /** Tailwind bg class for marker */
  bgClass: string;
  /** For dangerous levels: pulse animation */
  isDangerous: boolean;
}

const CATEGORIES: Record<AqiCategoryKey, Omit<AqiCategory, 'key'>> = {
  good: {
    label: 'Good',
    color: '#00e400',
    textColor: '#000000',
    ringClass: 'ring-green-500/60',
    bgClass: 'bg-[#00e400]',
    isDangerous: false,
  },
  moderate: {
    label: 'Moderate',
    color: '#ffff00',
    textColor: '#000000',
    ringClass: 'ring-yellow-400/60',
    bgClass: 'bg-[#ffff00]',
    isDangerous: false,
  },
  unhealthySensitive: {
    label: 'Unhealthy for Sensitive Groups',
    color: '#ff7e00',
    textColor: '#000000',
    ringClass: 'ring-orange-500/60',
    bgClass: 'bg-[#ff7e00]',
    isDangerous: false,
  },
  unhealthy: {
    label: 'Unhealthy',
    color: '#ff0000',
    textColor: '#ffffff',
    ringClass: 'ring-red-600/70',
    bgClass: 'bg-[#ff0000]',
    isDangerous: true,
  },
  veryUnhealthy: {
    label: 'Very Unhealthy',
    color: '#8f3f97',
    textColor: '#ffffff',
    ringClass: 'ring-fuchsia-700/70',
    bgClass: 'bg-[#8f3f97]',
    isDangerous: true,
  },
};

/**
 * Get AQI category for a numeric AQI value (US scale 0–500).
 */
export function getAqiCategory(aqi: number): AqiCategory {
  const key: AqiCategoryKey =
    aqi <= 50
      ? 'good'
      : aqi <= 100
        ? 'moderate'
        : aqi <= 150
          ? 'unhealthySensitive'
          : aqi <= 200
          ? 'unhealthy'
          : 'veryUnhealthy';
  return { key, ...CATEGORIES[key] };
}

/**
 * Get hex color for a given AQI (for inline styles where needed).
 */
export function getAqiColor(aqi: number): string {
  return getAqiCategory(aqi).color;
}

/**
 * Whether the given sensor passes the selected filter.
 */
export function sensorMatchesFilter(
  aqi: number,
  filter: SensorFilterValue
): boolean {
  if (filter === 'all') return true;
  const category = getAqiCategory(aqi);
  return category.key === filter;
}

export const SENSOR_FILTER_OPTIONS: { value: SensorFilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'good', label: 'Good' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'unhealthySensitive', label: 'Unhealthy for Sensitive Groups' },
  { value: 'unhealthy', label: 'Unhealthy' },
  { value: 'veryUnhealthy', label: 'Very Unhealthy' },
];
