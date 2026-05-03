import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, of, switchMap, throwError } from 'rxjs';
import { environment } from 'src/app/app.environment';
import { AirQualityResponse, ForecastResponse, GeoLocation, WeatherApiResource, WeatherData, WeatherUnit, XweatherAlertsResponse } from '../models/weather.model';

interface OpenMeteoGeoResponse {
  results?: OpenMeteoLocation[];
}

interface OpenMeteoLocation {
  id?: number;
  name: string;
  latitude: number;
  longitude: number;
  country_code?: string;
  country?: string;
  admin1?: string;
  timezone?: string;
}

interface OpenMeteoForecastResponse {
  latitude: number;
  longitude: number;
  timezone?: string;
  utc_offset_seconds?: number;
  current?: {
    time: string;
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    precipitation?: number;
    rain?: number;
    snowfall?: number;
    weather_code?: number;
    cloud_cover?: number;
    surface_pressure?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
    wind_gusts_10m?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    apparent_temperature?: number[];
    relative_humidity_2m?: number[];
    precipitation_probability?: number[];
    precipitation?: number[];
    rain?: number[];
    snowfall?: number[];
    weather_code?: number[];
    cloud_cover?: number[];
    surface_pressure?: number[];
    wind_speed_10m?: number[];
    wind_direction_10m?: number[];
    wind_gusts_10m?: number[];
    visibility?: number[];
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    sunrise?: string[];
    sunset?: string[];
  };
}

@Injectable({
  providedIn: 'root'
})
export class WeatherService {
  private readonly openMeteoGeocodingUrl = 'https://geocoding-api.open-meteo.com/v1/search';
  private readonly openMeteoForecastUrl = 'https://api.open-meteo.com/v1/forecast';

  constructor(private http: HttpClient) {}

  getWeatherData(cityName: string, units: WeatherUnit = 'imperial'): Observable<WeatherData> {
    return this.request<WeatherData>('weather', this.baseParams(units).set('q', cityName)).pipe(
      catchError(error => this.getOpenMeteoLocation(cityName).pipe(
        switchMap(location => location
          ? this.getOpenMeteoForecast(location, units).pipe(map(response => this.mapOpenMeteoWeather(response, location, units)))
          : throwError(() => error)
        )
      ))
    );
  }

  getWeatherByCoords(lat: number, lon: number, units: WeatherUnit = 'imperial', name = 'Current location'): Observable<WeatherData> {
    return this.request<WeatherData>(
      'weather',
      this.baseParams(units)
        .set('lat', lat.toString())
        .set('lon', lon.toString())
    ).pipe(
      catchError(error => {
        const location = this.locationFromCoords(lat, lon, name);
        return this.getOpenMeteoForecast(location, units).pipe(
          map(response => this.mapOpenMeteoWeather(response, location, units)),
          catchError(() => throwError(() => error))
        );
      })
    );
  }

  getForecast(cityName: string, units: WeatherUnit = 'imperial'): Observable<ForecastResponse> {
    return this.request<ForecastResponse>('forecast', this.baseParams(units).set('q', cityName)).pipe(
      catchError(error => this.getOpenMeteoLocation(cityName).pipe(
        switchMap(location => location
          ? this.getOpenMeteoForecast(location, units).pipe(map(response => this.mapOpenMeteoForecast(response, location, units)))
          : throwError(() => error)
        )
      ))
    );
  }

  getForecastByCoords(lat: number, lon: number, units: WeatherUnit = 'imperial', name = 'Current location'): Observable<ForecastResponse> {
    return this.request<ForecastResponse>(
      'forecast',
      this.baseParams(units)
        .set('lat', lat.toString())
        .set('lon', lon.toString())
    ).pipe(
      catchError(error => {
        const location = this.locationFromCoords(lat, lon, name);
        return this.getOpenMeteoForecast(location, units).pipe(
          map(response => this.mapOpenMeteoForecast(response, location, units)),
          catchError(() => throwError(() => error))
        );
      })
    );
  }

  getAirQuality(lat: number, lon: number): Observable<AirQualityResponse> {
    return this.request<AirQualityResponse>(
      'airPollution',
      new HttpParams()
        .set('lat', lat.toString())
        .set('lon', lon.toString())
    );
  }

  searchLocations(query: string, limit = 5): Observable<GeoLocation[]> {
    return this.request<GeoLocation[]>(
      'geocoding',
      new HttpParams()
        .set('q', query)
        .set('limit', limit.toString())
    ).pipe(
      catchError(() => this.searchOpenMeteoLocations(query, limit))
    );
  }

  getWeatherAlerts(lat: number, lon: number): Observable<XweatherAlertsResponse> {
    if (!environment.xweatherAlertsProxyUrl) {
      return of({ success: false, response: [] });
    }

    return this.http.get<XweatherAlertsResponse>(environment.xweatherAlertsProxyUrl, {
      params: new HttpParams()
        .set('lat', lat.toString())
        .set('lon', lon.toString())
    });
  }

  private request<T>(resource: WeatherApiResource, params: HttpParams): Observable<T> {
    if (environment.weatherApiProxyUrl) {
      return this.http.get<T>(environment.weatherApiProxyUrl, {
        params: params.set('resource', resource)
      });
    }

    return this.http.get<T>(this.endpoint(resource), {
      headers: this.headers,
      params
    });
  }

  private get headers(): HttpHeaders {
    let headers = new HttpHeaders();
    if (environment.weatherApiHostHeaderName) {
      headers = headers.set(environment.weatherApiHostHeaderName, environment.weatherApiHostHeaderValue);
    }
    if (environment.weatherApiKeyHeaderName) {
      headers = headers.set(environment.weatherApiKeyHeaderName, environment.weatherApiKeyHeaderValue);
    }
    return headers;
  }

  private baseParams(units: WeatherUnit): HttpParams {
    return new HttpParams()
      .set('units', units)
      .set('lang', 'en');
  }

  private endpoint(key: WeatherApiResource): string {
    const fallbackBase = environment.weatherApiBaseUrl;

    const endpoints = {
      weather: environment.weatherApiBaseUrl,
      forecast: environment.weatherForecastApiUrl || fallbackBase.replace('/weather', '/forecast'),
      airPollution: environment.weatherAirPollutionApiUrl || fallbackBase.replace('/weather', '/air_pollution'),
      geocoding: environment.weatherGeocodingApiUrl || fallbackBase.replace('/data/2.5/weather', '/geo/1.0/direct')
    };

    return endpoints[key];
  }

  private searchOpenMeteoLocations(query: string, limit = 5): Observable<GeoLocation[]> {
    const normalizedQuery = this.normalizeLocationQuery(query);
    if (!normalizedQuery) {
      return of([]);
    }

    const params = new HttpParams()
      .set('name', normalizedQuery)
      .set('count', limit.toString())
      .set('language', 'en')
      .set('format', 'json');

    return this.http.get<OpenMeteoGeoResponse>(this.openMeteoGeocodingUrl, { params }).pipe(
      map(response => (response.results ?? []).map(location => this.mapOpenMeteoLocation(location)))
    );
  }

  private getOpenMeteoLocation(query: string): Observable<GeoLocation | undefined> {
    return this.searchOpenMeteoLocations(query, 1).pipe(
      map(locations => locations[0])
    );
  }

  private getOpenMeteoForecast(location: GeoLocation, units: WeatherUnit): Observable<OpenMeteoForecastResponse> {
    const params = new HttpParams()
      .set('latitude', location.lat.toString())
      .set('longitude', location.lon.toString())
      .set('timezone', 'auto')
      .set('forecast_days', '6')
      .set('current', [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'precipitation',
        'rain',
        'snowfall',
        'weather_code',
        'cloud_cover',
        'surface_pressure',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m'
      ].join(','))
      .set('hourly', [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'precipitation_probability',
        'precipitation',
        'rain',
        'snowfall',
        'weather_code',
        'cloud_cover',
        'surface_pressure',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
        'visibility'
      ].join(','))
      .set('daily', [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'sunrise',
        'sunset'
      ].join(','))
      .set('wind_speed_unit', units === 'imperial' ? 'mph' : 'ms');

    const unitParams = units === 'imperial'
      ? params.set('temperature_unit', 'fahrenheit')
      : params;

    return this.http.get<OpenMeteoForecastResponse>(this.openMeteoForecastUrl, { params: unitParams });
  }

  private mapOpenMeteoWeather(response: OpenMeteoForecastResponse, location: GeoLocation, units: WeatherUnit): WeatherData {
    const current = (response.current ?? {}) as NonNullable<OpenMeteoForecastResponse['current']>;
    const hourly = (response.hourly ?? {}) as NonNullable<OpenMeteoForecastResponse['hourly']>;
    const daily = (response.daily ?? {}) as NonNullable<OpenMeteoForecastResponse['daily']>;
    const timezoneOffset = response.utc_offset_seconds ?? 0;
    const weather = this.mapWeatherCode(current.weather_code);
    const precipitation = current.rain ?? current.precipitation;
    const snowfall = current.snowfall;

    return {
      coord: { lat: response.latitude ?? location.lat, lon: response.longitude ?? location.lon },
      weather: [weather],
      base: 'open-meteo',
      main: {
        temp: current.temperature_2m ?? hourly.temperature_2m?.[0] ?? 0,
        feels_like: current.apparent_temperature ?? hourly.apparent_temperature?.[0] ?? current.temperature_2m ?? 0,
        temp_min: daily.temperature_2m_min?.[0] ?? current.temperature_2m ?? 0,
        temp_max: daily.temperature_2m_max?.[0] ?? current.temperature_2m ?? 0,
        pressure: Math.round(current.surface_pressure ?? hourly.surface_pressure?.[0] ?? 1013),
        humidity: Math.round(current.relative_humidity_2m ?? hourly.relative_humidity_2m?.[0] ?? 0)
      },
      visibility: hourly.visibility?.[0],
      wind: {
        speed: current.wind_speed_10m ?? hourly.wind_speed_10m?.[0] ?? 0,
        deg: current.wind_direction_10m ?? hourly.wind_direction_10m?.[0],
        gust: current.wind_gusts_10m ?? hourly.wind_gusts_10m?.[0]
      },
      clouds: { all: Math.round(current.cloud_cover ?? hourly.cloud_cover?.[0] ?? 0) },
      rain: precipitation ? { '1h': precipitation } : undefined,
      snow: snowfall ? { '1h': snowfall } : undefined,
      dt: this.localIsoToUnix(current.time ?? hourly.time?.[0], timezoneOffset),
      sys: {
        country: location.country || '',
        sunrise: this.localIsoToUnix(daily.sunrise?.[0], timezoneOffset),
        sunset: this.localIsoToUnix(daily.sunset?.[0], timezoneOffset)
      },
      timezone: timezoneOffset,
      id: 0,
      name: location.name,
      cod: 200
    };
  }

  private mapOpenMeteoForecast(response: OpenMeteoForecastResponse, location: GeoLocation, units: WeatherUnit): ForecastResponse {
    const hourly = (response.hourly ?? {}) as NonNullable<OpenMeteoForecastResponse['hourly']>;
    const daily = (response.daily ?? {}) as NonNullable<OpenMeteoForecastResponse['daily']>;
    const timezoneOffset = response.utc_offset_seconds ?? 0;
    const times = hourly.time ?? [];
    const list = times
      .map((time, index) => ({ time, index }))
      .filter((_, index) => index % 3 === 0)
      .slice(0, 48)
      .map(({ time, index }) => {
        const weather = this.mapWeatherCode(hourly.weather_code?.[index]);
        const rain = hourly.rain?.[index] ?? hourly.precipitation?.[index];
        const snow = hourly.snowfall?.[index];

        return {
          dt: this.localIsoToUnix(time, timezoneOffset),
          main: {
            temp: hourly.temperature_2m?.[index] ?? 0,
            feels_like: hourly.apparent_temperature?.[index] ?? hourly.temperature_2m?.[index] ?? 0,
            temp_min: hourly.temperature_2m?.[index] ?? 0,
            temp_max: hourly.temperature_2m?.[index] ?? 0,
            pressure: Math.round(hourly.surface_pressure?.[index] ?? 1013),
            humidity: Math.round(hourly.relative_humidity_2m?.[index] ?? 0)
          },
          weather: [weather],
          clouds: { all: Math.round(hourly.cloud_cover?.[index] ?? 0) },
          wind: {
            speed: hourly.wind_speed_10m?.[index] ?? 0,
            deg: hourly.wind_direction_10m?.[index],
            gust: hourly.wind_gusts_10m?.[index]
          },
          visibility: hourly.visibility?.[index],
          pop: (hourly.precipitation_probability?.[index] ?? 0) / 100,
          rain: rain ? { '3h': rain } : undefined,
          snow: snow ? { '3h': snow } : undefined,
          dt_txt: this.openWeatherDateText(time)
        };
      });

    return {
      cod: '200',
      message: 0,
      cnt: list.length,
      list,
      city: {
        id: 0,
        name: location.name,
        coord: { lat: response.latitude ?? location.lat, lon: response.longitude ?? location.lon },
        country: location.country || '',
        timezone: timezoneOffset,
        sunrise: this.localIsoToUnix(daily.sunrise?.[0], timezoneOffset),
        sunset: this.localIsoToUnix(daily.sunset?.[0], timezoneOffset)
      }
    };
  }

  private mapOpenMeteoLocation(location: OpenMeteoLocation): GeoLocation {
    return {
      name: location.name,
      state: location.admin1,
      country: location.country_code || location.country || '',
      lat: location.latitude,
      lon: location.longitude
    };
  }

  private locationFromCoords(lat: number, lon: number, name: string): GeoLocation {
    const parts = name.split(',').map(part => part.trim()).filter(Boolean);

    return {
      name: parts[0] || 'Current location',
      country: parts[1] || '',
      lat,
      lon
    };
  }

  private normalizeLocationQuery(query: string): string {
    return query
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)[0] || query.trim();
  }

  private localIsoToUnix(value: string | undefined, timezoneOffset: number): number {
    if (!value) {
      return Math.floor(Date.now() / 1000);
    }

    return Math.round(Date.parse(`${value}Z`) / 1000) - timezoneOffset;
  }

  private openWeatherDateText(value: string): string {
    return value.replace('T', ' ') + ':00';
  }

  private mapWeatherCode(code: number | undefined): { id: number; main: string; description: string; icon: string } {
    if (code === 0) {
      return { id: 800, main: 'Clear', description: 'clear sky', icon: '01d' };
    }
    if ([1, 2].includes(code ?? -1)) {
      return { id: 801, main: 'Clouds', description: 'partly cloudy', icon: '02d' };
    }
    if (code === 3) {
      return { id: 804, main: 'Clouds', description: 'overcast clouds', icon: '04d' };
    }
    if ([45, 48].includes(code ?? -1)) {
      return { id: 741, main: 'Mist', description: 'foggy conditions', icon: '50d' };
    }
    if ([51, 53, 55, 56, 57].includes(code ?? -1)) {
      return { id: 300, main: 'Drizzle', description: 'drizzle', icon: '09d' };
    }
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code ?? -1)) {
      return { id: 500, main: 'Rain', description: 'rain showers', icon: '10d' };
    }
    if ([71, 73, 75, 77, 85, 86].includes(code ?? -1)) {
      return { id: 600, main: 'Snow', description: 'snow showers', icon: '13d' };
    }
    if ([95, 96, 99].includes(code ?? -1)) {
      return { id: 200, main: 'Thunderstorm', description: 'thunderstorm', icon: '11d' };
    }

    return { id: 801, main: 'Clouds', description: 'variable clouds', icon: '02d' };
  }
}
