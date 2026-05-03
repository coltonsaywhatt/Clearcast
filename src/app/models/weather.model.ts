export type WeatherUnit = 'imperial' | 'metric';

export interface WeatherData {
  coord: Coord;
  weather: Weather[];
  base?: string;
  main: Main;
  visibility?: number;
  wind: Wind;
  clouds?: Clouds;
  rain?: Precipitation;
  snow?: Precipitation;
  dt: number;
  sys: Sys;
  timezone: number;
  id: number;
  name: string;
  cod: number;
}

export interface Coord {
  lon: number;
  lat: number;
}

export interface Weather {
  id: number;
  main: string;
  description: string;
  icon: string;
}

export interface Main {
  temp: number;
  feels_like: number;
  temp_min: number;
  temp_max: number;
  pressure: number;
  humidity: number;
  sea_level?: number;
  grnd_level?: number;
}

export interface Wind {
  speed: number;
  deg?: number;
  gust?: number;
}

export interface Clouds {
  all: number;
}

export interface Sys {
  type?: number;
  id?: number;
  country: string;
  sunrise: number;
  sunset: number;
}

export interface Precipitation {
  '1h'?: number;
  '3h'?: number;
}

export interface ForecastResponse {
  cod: string;
  message: number;
  cnt: number;
  list: ForecastListItem[];
  city: ForecastCity;
}

export interface ForecastListItem {
  dt: number;
  main: Main;
  weather: Weather[];
  clouds?: Clouds;
  wind: Wind;
  visibility?: number;
  pop?: number;
  rain?: Precipitation;
  snow?: Precipitation;
  dt_txt?: string;
}

export interface ForecastCity {
  id: number;
  name: string;
  coord: Coord;
  country: string;
  timezone: number;
  sunrise: number;
  sunset: number;
}

export interface ForecastDay {
  date: string;
  dayName: string;
  icon: string;
  description: string;
  tempMin: number;
  tempMax: number;
  humidity: number;
  rainChance: number;
  windSpeed: number;
}

export interface HourlyForecast {
  time: string;
  timestamp: number;
  temp: number;
  feelsLike: number;
  icon: string;
  description: string;
  rainChance: number;
  windSpeed: number;
  humidity: number;
  pressure?: number;
  visibility?: number;
}

export interface AirQualityResponse {
  coord: Coord;
  list: AirQualityItem[];
}

export interface AirQualityItem {
  main: {
    aqi: number;
  };
  components: AirQualityComponents;
  dt: number;
}

export interface AirQualityComponents {
  co?: number;
  no?: number;
  no2?: number;
  o3?: number;
  so2?: number;
  pm2_5?: number;
  pm10?: number;
  nh3?: number;
}

export interface GeoLocation {
  name: string;
  local_names?: Record<string, string>;
  lat: number;
  lon: number;
  country: string;
  state?: string;
}

export interface SavedLocation {
  name: string;
  country?: string;
  lat: number;
  lon: number;
}

export type WeatherApiResource = 'weather' | 'forecast' | 'airPollution' | 'geocoding';

export interface XweatherAlertsResponse {
  success?: boolean;
  error?: {
    code?: string;
    description?: string;
    message?: string;
  };
  response?: XweatherAlertResult[];
}

export interface XweatherAlertResult {
  id?: string;
  loc?: {
    lat?: number;
    long?: number;
  };
  profile?: {
    tz?: string;
  };
  details?: {
    name?: string;
    type?: string;
    color?: string;
    body?: string;
    bodyFull?: string;
    source?: string;
  };
  timestamps?: {
    issued?: number;
    begins?: number;
    expires?: number;
  };
}

export interface WeatherAlert {
  id: string;
  title: string;
  type: string;
  severity: string;
  color?: string;
  source?: string;
  body?: string;
  issued?: number;
  expires?: number;
}

export interface ForecastDetail {
  title: string;
  subtitle: string;
  icon: string;
  description: string;
  temp: string;
  feelsLike?: string;
  rainChance: number;
  wind: string;
  humidity: number;
  pressure?: string;
  visibility?: string;
}
