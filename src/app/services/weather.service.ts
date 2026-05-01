import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { environment } from 'src/environments/environment';
import { AirQualityResponse, ForecastResponse, GeoLocation, WeatherApiResource, WeatherData, WeatherUnit, XweatherAlertsResponse } from '../models/weather.model';

@Injectable({
  providedIn: 'root'
})
export class WeatherService {
  constructor(private http: HttpClient) {}

  getWeatherData(cityName: string, units: WeatherUnit = 'imperial'): Observable<WeatherData> {
    return this.request<WeatherData>('weather', this.baseParams(units).set('q', cityName));
  }

  getWeatherByCoords(lat: number, lon: number, units: WeatherUnit = 'imperial'): Observable<WeatherData> {
    return this.request<WeatherData>(
      'weather',
      this.baseParams(units)
        .set('lat', lat.toString())
        .set('lon', lon.toString())
    );
  }

  getForecast(cityName: string, units: WeatherUnit = 'imperial'): Observable<ForecastResponse> {
    return this.request<ForecastResponse>('forecast', this.baseParams(units).set('q', cityName));
  }

  getForecastByCoords(lat: number, lon: number, units: WeatherUnit = 'imperial'): Observable<ForecastResponse> {
    return this.request<ForecastResponse>(
      'forecast',
      this.baseParams(units)
        .set('lat', lat.toString())
        .set('lon', lon.toString())
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
    return new HttpHeaders()
      .set(environment.weatherApiHostHeaderName, environment.weatherApiHostHeaderValue)
      .set(environment.weatherApiKeyHeaderName, environment.weatherApiKeyHeaderValue);
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
}
