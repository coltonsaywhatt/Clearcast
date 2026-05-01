import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { NgChartsModule } from 'ng2-charts';
import { of } from 'rxjs';
import { AppComponent } from './app.component';
import { WeatherService } from './services/weather.service';

describe('AppComponent', () => {
  const weatherServiceSpy = jasmine.createSpyObj<WeatherService>('WeatherService', [
    'getWeatherData',
    'getForecast',
    'getAirQuality',
    'getWeatherAlerts',
    'searchLocations'
  ]);

  beforeEach(async () => {
    weatherServiceSpy.getWeatherData.and.returnValue(of({
      coord: { lat: 27.95, lon: -82.46 },
      weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
      main: { temp: 78, feels_like: 79, temp_min: 72, temp_max: 84, pressure: 1014, humidity: 58 },
      visibility: 10000,
      wind: { speed: 7, deg: 90 },
      clouds: { all: 4 },
      dt: 1714500000,
      sys: { country: 'US', sunrise: 1714470000, sunset: 1714519000 },
      timezone: -14400,
      id: 4174757,
      name: 'Tampa',
      cod: 200
    }));
    weatherServiceSpy.getForecast.and.returnValue(of({
      cod: '200',
      message: 0,
      cnt: 0,
      city: {
        id: 4174757,
        name: 'Tampa',
        coord: { lat: 27.95, lon: -82.46 },
        country: 'US',
        timezone: -14400,
        sunrise: 1714470000,
        sunset: 1714519000
      },
      list: []
    }));
    weatherServiceSpy.getAirQuality.and.returnValue(of({
      coord: { lat: 27.95, lon: -82.46 },
      list: [{ main: { aqi: 1 }, components: { pm2_5: 4, pm10: 9, o3: 30, no2: 8 }, dt: 1714500000 }]
    }));
    weatherServiceSpy.getWeatherAlerts.and.returnValue(of({ success: true, response: [] }));
    weatherServiceSpy.searchLocations.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [
        RouterTestingModule,
        FormsModule,
        HttpClientTestingModule,
        NgChartsModule
      ],
      declarations: [
        AppComponent
      ],
      providers: [
        { provide: WeatherService, useValue: weatherServiceSpy }
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the premium dashboard brand', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Weather Command');
  });

  it('should map weather icon codes to local symbol classes', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    expect(app.weatherIconClass('11d', 'Thunderstorm')).toBe('fa-cloud-bolt');
    expect(app.weatherIconClass('13d', 'Snow')).toBe('fa-snowflake');
  });

  it('should clear search state', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.cityName = 'Tampa';
    app.searchQuery = 'Tampa';
    app.suggestions = [{ name: 'Tampa', lat: 27.95, lon: -82.46, country: 'US' }];

    app.clearSearch();

    expect(app.cityName).toBe('');
    expect(app.searchQuery).toBe('');
    expect(app.suggestions.length).toBe(0);
  });
});
