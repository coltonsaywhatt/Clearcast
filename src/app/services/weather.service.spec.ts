import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from 'src/app/app.environment';

import { WeatherService } from './weather.service';

describe('WeatherService', () => {
  let service: WeatherService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(WeatherService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should request current weather through the configured API proxy', () => {
    service.getWeatherData('Tampa').subscribe();

    const request = httpMock.expectOne(req => req.url === environment.weatherApiProxyUrl);
    expect(request.request.params.get('resource')).toBe('weather');
    expect(request.request.params.get('q')).toBe('Tampa');
    expect(request.request.params.get('units')).toBe('imperial');
    expect(request.request.headers.has(environment.weatherApiKeyHeaderName)).toBeFalse();
    request.flush({});
  });

  it('should request weather alerts through the configured proxy', () => {
    service.getWeatherAlerts(27.95, -82.46).subscribe();

    const request = httpMock.expectOne(req => req.url === environment.xweatherAlertsProxyUrl);
    expect(request.request.params.get('lat')).toBe('27.95');
    expect(request.request.params.get('lon')).toBe('-82.46');
    request.flush({ success: false, response: [] });
  });

  it('should fall back to Open-Meteo when city weather search through the proxy fails', () => {
    let resultName = '';

    service.getWeatherData('Seattle').subscribe(result => {
      resultName = result.name;
    });

    const proxyRequest = httpMock.expectOne(req => req.url === environment.weatherApiProxyUrl);
    proxyRequest.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });

    const geocodeRequest = httpMock.expectOne(req => req.url === 'https://geocoding-api.open-meteo.com/v1/search');
    expect(geocodeRequest.request.params.get('name')).toBe('Seattle');
    geocodeRequest.flush({
      results: [{
        name: 'Seattle',
        latitude: 47.6062,
        longitude: -122.3321,
        country_code: 'US',
        admin1: 'Washington'
      }]
    });

    const forecastRequest = httpMock.expectOne(req => req.url === 'https://api.open-meteo.com/v1/forecast');
    expect(forecastRequest.request.params.get('latitude')).toBe('47.6062');
    forecastRequest.flush({
      latitude: 47.6062,
      longitude: -122.3321,
      utc_offset_seconds: -25200,
      current: {
        time: '2026-05-02T12:00',
        temperature_2m: 62,
        apparent_temperature: 61,
        relative_humidity_2m: 68,
        weather_code: 2,
        cloud_cover: 40,
        surface_pressure: 1015,
        wind_speed_10m: 8,
        wind_direction_10m: 320,
        wind_gusts_10m: 14
      },
      hourly: {
        time: ['2026-05-02T12:00'],
        temperature_2m: [62],
        apparent_temperature: [61],
        relative_humidity_2m: [68],
        surface_pressure: [1015],
        wind_speed_10m: [8],
        wind_direction_10m: [320],
        wind_gusts_10m: [14],
        cloud_cover: [40],
        visibility: [10000]
      },
      daily: {
        sunrise: ['2026-05-02T05:45'],
        sunset: ['2026-05-02T20:20'],
        temperature_2m_min: [52],
        temperature_2m_max: [66]
      }
    });

    expect(resultName).toBe('Seattle');
  });
});
