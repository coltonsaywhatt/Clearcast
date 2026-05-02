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

  it('should skip Xweather alert HTTP calls when alerts proxy is not configured', () => {
    service.getWeatherAlerts(27.95, -82.46).subscribe(response => {
      expect(response.success).toBeFalse();
      expect(response.response).toEqual([]);
    });
  });
});
