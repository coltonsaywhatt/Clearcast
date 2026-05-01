import { AirQualityItem, ForecastListItem, WeatherData, WeatherUnit } from '../models/weather.model';

export const UNIT_SYMBOL: Record<WeatherUnit, string> = {
  imperial: 'F',
  metric: 'C'
};

export const WIND_UNIT: Record<WeatherUnit, string> = {
  imperial: 'mph',
  metric: 'm/s'
};

export function formatTemperature(value?: number, unit: WeatherUnit = 'imperial'): string {
  return typeof value === 'number' ? `${Math.round(value)}°${UNIT_SYMBOL[unit]}` : '--';
}

export function formatDistance(meters?: number, unit: WeatherUnit = 'imperial'): string {
  if (typeof meters !== 'number') {
    return '--';
  }

  return unit === 'imperial'
    ? `${(meters / 1609.344).toFixed(1)} mi`
    : `${(meters / 1000).toFixed(1)} km`;
}

export function formatWindDirection(degrees?: number): string {
  if (typeof degrees !== 'number') {
    return 'Variable';
  }

  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round(((degrees % 360) / 45)) % 8];
}

export function formatTime(timestampSeconds: number, timezoneOffset = 0): string {
  return new Date((timestampSeconds + timezoneOffset) * 1000).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC'
  });
}

export function formatDay(timestampSeconds: number, timezoneOffset = 0, style: 'short' | 'long' = 'short'): string {
  return new Date((timestampSeconds + timezoneOffset) * 1000).toLocaleDateString('en-US', {
    weekday: style,
    timeZone: 'UTC'
  });
}

export function getWeatherMood(data?: WeatherData): 'clear' | 'cloudy' | 'rain' | 'snow' | 'storm' | 'mist' {
  const condition = data?.weather?.[0]?.main?.toLowerCase() ?? '';

  if (condition.includes('thunder') || condition.includes('storm')) {
    return 'storm';
  }
  if (condition.includes('rain') || condition.includes('drizzle')) {
    return 'rain';
  }
  if (condition.includes('snow')) {
    return 'snow';
  }
  if (condition.includes('mist') || condition.includes('fog') || condition.includes('haze') || condition.includes('smoke')) {
    return 'mist';
  }
  if (condition.includes('cloud')) {
    return 'cloudy';
  }
  return 'clear';
}

export function getAqiLabel(aqi?: number): string {
  return ['Unknown', 'Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'][aqi ?? 0] ?? 'Unknown';
}

export function getAqiTone(aqi?: number): string {
  return ['neutral', 'good', 'fair', 'moderate', 'poor', 'very-poor'][aqi ?? 0] ?? 'neutral';
}

export function buildInsight(
  weather: WeatherData | undefined,
  nextHours: ForecastListItem[],
  airQuality?: AirQualityItem,
  unit: WeatherUnit = 'imperial'
): string {
  if (!weather) {
    return 'Search for a location to generate a weather briefing.';
  }

  const condition = weather.weather?.[0]?.main?.toLowerCase() ?? '';
  const rainChance = Math.max(...nextHours.slice(0, 4).map(item => Math.round((item.pop ?? 0) * 100)), 0);
  const wind = weather.wind?.speed ?? 0;
  const temp = weather.main?.temp ?? 0;
  const aqi = airQuality?.main?.aqi;

  if (condition.includes('thunder') || condition.includes('storm')) {
    return 'Storm risk is elevated. Keep plans flexible, charge devices, and avoid exposed outdoor routes.';
  }
  if (rainChance >= 55 || condition.includes('rain') || condition.includes('drizzle')) {
    return `Bring an umbrella. The next few hours show up to ${rainChance}% precipitation risk.`;
  }
  if (aqi && aqi >= 4) {
    return `Air quality is ${getAqiLabel(aqi).toLowerCase()}. Keep strenuous outdoor plans short if you are sensitive.`;
  }
  if (unit === 'imperial' ? temp >= 88 : temp >= 31) {
    return 'Heat is the main factor today. Hydrate early, seek shade, and keep high-effort plans to cooler hours.';
  }
  if (unit === 'imperial' ? temp <= 40 : temp <= 5) {
    return 'Cold air is in place. Layer up and watch for slick surfaces during the commute.';
  }
  if (wind >= (unit === 'imperial' ? 22 : 10)) {
    return 'Wind is noticeable. Secure loose outdoor items and expect a brisk feel in exposed areas.';
  }

  return 'Comfortable conditions overall. It is a good window for a walk, errands, or outdoor work.';
}
