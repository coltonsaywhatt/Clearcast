import { Component, OnDestroy, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Chart, registerables, type ChartConfiguration, type ChartOptions } from 'chart.js';
import { catchError, debounceTime, distinctUntilChanged, forkJoin, of, Subject, Subscription, switchMap, tap } from 'rxjs';
import {
  AirQualityItem,
  ForecastDay,
  ForecastDetail,
  ForecastListItem,
  ForecastResponse,
  GeoLocation,
  HourlyForecast,
  SavedLocation,
  WeatherData,
  WeatherAlert,
  WeatherUnit,
  XweatherAlertsResponse
} from './models/weather.model';
import { WeatherService } from './services/weather.service';
import {
  buildInsight,
  formatDay,
  formatDistance,
  formatTemperature,
  formatTime,
  formatWindDirection,
  getAqiLabel,
  getAqiTone,
  getWeatherMood,
  WIND_UNIT
} from './utils/weather.utils';

Chart.register(...registerables);

type ThemeMode = 'dark' | 'light';
type SearchTarget = string | { lat: number; lon: number; name: string };

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  cityName = '';
  weatherData?: WeatherData;
  forecast: ForecastDay[] = [];
  hourlyForecast: HourlyForecast[] = [];
  airQuality?: AirQualityItem;
  alerts: WeatherAlert[] = [];
  suggestions: GeoLocation[] = [];
  favorites: SavedLocation[] = [];
  activeSuggestionIndex = -1;
  searchQuery = '';
  favoritesManaging = false;
  selectedDetail?: ForecastDetail;
  loading = true;
  forecastLoading = false;
  suggestionsLoading = false;
  errorMessage = '';
  alertNotice = '';
  unit: WeatherUnit = 'imperial';
  localTime = '';
  themeClass = 'theme-clear';
  themeMode: ThemeMode = 'dark';
  insight = 'Search for a location to generate a weather briefing.';
  lastTarget: SearchTarget = 'Tampa';
  chartReady = false;
  readonly weatherIconMap: Record<string, string> = {
    '01': 'fa-sun',
    '02': 'fa-cloud-sun',
    '03': 'fa-cloud',
    '04': 'fa-cloud',
    '09': 'fa-cloud-showers-heavy',
    '10': 'fa-cloud-sun-rain',
    '11': 'fa-cloud-bolt',
    '13': 'fa-snowflake',
    '50': 'fa-smog'
  };

  readonly searchTerms$ = new Subject<string>();
  readonly skeletonCards = Array.from({ length: 6 });
  readonly fallbackLocations: GeoLocation[] = [
    { name: 'Tampa', state: 'Florida', country: 'US', lat: 27.9506, lon: -82.4572 },
    { name: 'New York', state: 'New York', country: 'US', lat: 40.7128, lon: -74.006 },
    { name: 'Los Angeles', state: 'California', country: 'US', lat: 34.0522, lon: -118.2437 },
    { name: 'Chicago', state: 'Illinois', country: 'US', lat: 41.8781, lon: -87.6298 },
    { name: 'Houston', state: 'Texas', country: 'US', lat: 29.7604, lon: -95.3698 },
    { name: 'Phoenix', state: 'Arizona', country: 'US', lat: 33.4484, lon: -112.074 },
    { name: 'Philadelphia', state: 'Pennsylvania', country: 'US', lat: 39.9526, lon: -75.1652 },
    { name: 'San Antonio', state: 'Texas', country: 'US', lat: 29.4252, lon: -98.4946 },
    { name: 'San Diego', state: 'California', country: 'US', lat: 32.7157, lon: -117.1611 },
    { name: 'Dallas', state: 'Texas', country: 'US', lat: 32.7767, lon: -96.797 },
    { name: 'San Jose', state: 'California', country: 'US', lat: 37.3382, lon: -121.8863 },
    { name: 'Jacksonville', state: 'Florida', country: 'US', lat: 30.3322, lon: -81.6557 },
    { name: 'Fort Worth', state: 'Texas', country: 'US', lat: 32.7555, lon: -97.3308 },
    { name: 'Columbus', state: 'Ohio', country: 'US', lat: 39.9612, lon: -82.9988 },
    { name: 'Charlotte', state: 'North Carolina', country: 'US', lat: 35.2271, lon: -80.8431 },
    { name: 'San Francisco', state: 'California', country: 'US', lat: 37.7749, lon: -122.4194 },
    { name: 'Indianapolis', state: 'Indiana', country: 'US', lat: 39.7684, lon: -86.1581 },
    { name: 'Nashville', state: 'Tennessee', country: 'US', lat: 36.1627, lon: -86.7816 },
    { name: 'Boston', state: 'Massachusetts', country: 'US', lat: 42.3601, lon: -71.0589 },
    { name: 'Portland', state: 'Oregon', country: 'US', lat: 45.5152, lon: -122.6784 },
    { name: 'Las Vegas', state: 'Nevada', country: 'US', lat: 36.1716, lon: -115.1391 },
    { name: 'Orlando', state: 'Florida', country: 'US', lat: 28.5383, lon: -81.3792 },
    { name: 'Atlanta', state: 'Georgia', country: 'US', lat: 33.749, lon: -84.388 },
    { name: 'Washington', state: 'District of Columbia', country: 'US', lat: 38.9072, lon: -77.0369 },
    { name: 'Miami', state: 'Florida', country: 'US', lat: 25.7617, lon: -80.1918 },
    { name: 'Seattle', state: 'Washington', country: 'US', lat: 47.6062, lon: -122.3321 },
    { name: 'Denver', state: 'Colorado', country: 'US', lat: 39.7392, lon: -104.9903 },
    { name: 'Austin', state: 'Texas', country: 'US', lat: 30.2672, lon: -97.7431 },
    { name: 'London', country: 'GB', lat: 51.5072, lon: -0.1276 },
    { name: 'Paris', country: 'FR', lat: 48.8566, lon: 2.3522 },
    { name: 'Toronto', state: 'Ontario', country: 'CA', lat: 43.6532, lon: -79.3832 },
    { name: 'Mexico City', country: 'MX', lat: 19.4326, lon: -99.1332 },
    { name: 'Madrid', country: 'ES', lat: 40.4168, lon: -3.7038 },
    { name: 'Rome', country: 'IT', lat: 41.9028, lon: 12.4964 },
    { name: 'Berlin', country: 'DE', lat: 52.52, lon: 13.405 },
    { name: 'Amsterdam', country: 'NL', lat: 52.3676, lon: 4.9041 },
    { name: 'Dubai', country: 'AE', lat: 25.2048, lon: 55.2708 },
    { name: 'Singapore', country: 'SG', lat: 1.3521, lon: 103.8198 },
    { name: 'Tokyo', country: 'JP', lat: 35.6762, lon: 139.6503 },
    { name: 'Sydney', country: 'AU', lat: -33.8688, lon: 151.2093 }
  ];

  hourlyChartData: ChartConfiguration<'line'>['data'] = { labels: [], datasets: [] };
  hourlyChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true,
        labels: { color: '#dbeafe', boxWidth: 10, usePointStyle: true }
      },
      tooltip: {
        callbacks: {
          label: context => {
            const value = context.raw as number;
            const suffix = context.dataset.label === 'Rain chance' ? '%' : `°${this.unitSymbol}`;
            return `${context.dataset.label}: ${Math.round(value)}${suffix}`;
          }
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#94a3b8' },
        grid: { display: false }
      },
      y: {
        ticks: { color: '#94a3b8' },
        grid: { color: 'rgba(148, 163, 184, 0.14)' }
      }
    }
  };

  private subscriptions = new Subscription();
  private clockId?: number;

  constructor(
    private weatherService: WeatherService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.loadPreferences();
    this.listenForSearchSuggestions();
    this.loadDefaultLocation();
    this.clockId = window.setInterval(() => this.updateLocalTime(), 60_000);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.clockId) {
      window.clearInterval(this.clockId);
    }
  }

  onSubmit(): void {
    const city = this.cityName.trim();
    if (!city) {
      this.errorMessage = 'Enter a city name to search.';
      return;
    }

    this.suggestions = [];
    this.activeSuggestionIndex = -1;
    this.search(city);
  }

  onSearchInput(value: string): void {
    const query = value.trim();
    this.searchQuery = query;
    this.activeSuggestionIndex = -1;
    this.searchTerms$.next(query);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (!this.suggestions.length) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeSuggestionIndex = Math.min(this.activeSuggestionIndex + 1, this.suggestions.length - 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeSuggestionIndex = Math.max(this.activeSuggestionIndex - 1, 0);
    } else if (event.key === 'Enter' && this.activeSuggestionIndex >= 0) {
      event.preventDefault();
      this.onSuggestionSelect(this.suggestions[this.activeSuggestionIndex]);
    } else if (event.key === 'Escape') {
      this.suggestions = [];
      this.activeSuggestionIndex = -1;
    }
  }

  onSuggestionSelect(location: GeoLocation): void {
    this.cityName = '';
    this.searchQuery = '';
    this.suggestions = [];
    this.activeSuggestionIndex = -1;
    this.search({ lat: location.lat, lon: location.lon, name: this.locationLabel(location) });
  }

  clearSearch(): void {
    this.cityName = '';
    this.searchQuery = '';
    this.suggestions = [];
    this.activeSuggestionIndex = -1;
    this.errorMessage = '';
  }

  searchTypedLocation(): void {
    const query = this.searchQuery.trim();
    if (!query) {
      return;
    }

    this.cityName = query;
    this.suggestions = [];
    this.activeSuggestionIndex = -1;
    this.search(query);
  }

  onUseMyLocation(): void {
    this.errorMessage = '';
    if (!navigator.geolocation) {
      this.errorMessage = 'Geolocation is not available in this browser.';
      return;
    }

    this.loading = true;
    navigator.geolocation.getCurrentPosition(
      position => this.search({
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        name: 'Current location'
      }),
      () => {
        this.loading = false;
        this.errorMessage = 'Unable to access your location. Search manually or allow location access.';
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  onSavedLocationSelect(location: SavedLocation): void {
    this.search({ lat: location.lat, lon: location.lon, name: location.name });
  }

  toggleFavorite(): void {
    if (!this.weatherData) {
      return;
    }

    const location = this.currentSavedLocation;
    const exists = this.isFavorite;
    this.favorites = exists
      ? this.favorites.filter(item => !this.sameLocation(item, location))
      : [location, ...this.favorites].slice(0, 8);
    this.persistLocations('weatherFavorites', this.favorites);
  }

  toggleFavoritesManager(): void {
    this.favoritesManaging = !this.favoritesManaging;
  }

  removeFavorite(location: SavedLocation): void {
    this.favorites = this.favorites.filter(item => !this.sameLocation(item, location));
    this.persistLocations('weatherFavorites', this.favorites);
  }

  renameFavorite(location: SavedLocation): void {
    const name = window.prompt('Favorite name', location.name)?.trim();
    if (!name) {
      return;
    }

    this.favorites = this.favorites.map(item => this.sameLocation(item, location) ? { ...item, name } : item);
    this.persistLocations('weatherFavorites', this.favorites);
  }

  moveFavorite(location: SavedLocation, direction: -1 | 1): void {
    const index = this.favorites.findIndex(item => this.sameLocation(item, location));
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= this.favorites.length) {
      return;
    }

    const next = [...this.favorites];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    this.favorites = next;
    this.persistLocations('weatherFavorites', this.favorites);
  }

  toggleUnit(): void {
    this.unit = this.unit === 'imperial' ? 'metric' : 'imperial';
    localStorage.setItem('weatherUnit', this.unit);
    this.search(this.lastTarget, true);
  }

  toggleTheme(): void {
    this.themeMode = this.themeMode === 'dark' ? 'light' : 'dark';
    localStorage.setItem('weatherTheme', this.themeMode);
    this.applyTheme();
    if (this.chartReady) {
      this.buildHourlyChart();
    }
  }

  retry(): void {
    this.search(this.lastTarget);
  }

  selectHourDetail(hour: HourlyForecast): void {
    this.selectedDetail = {
      title: hour.time,
      subtitle: 'Hourly forecast',
      icon: hour.icon,
      description: hour.description,
      temp: this.formatTemp(hour.temp),
      feelsLike: this.formatTemp(hour.feelsLike),
      rainChance: hour.rainChance,
      wind: `${Math.round(hour.windSpeed)} ${this.windUnit}`,
      humidity: hour.humidity,
      pressure: hour.pressure ? `${hour.pressure} hPa` : undefined,
      visibility: formatDistance(hour.visibility, this.unit)
    };
  }

  selectDayDetail(day: ForecastDay): void {
    this.selectedDetail = {
      title: day.dayName,
      subtitle: 'Daily outlook',
      icon: day.icon,
      description: day.description,
      temp: `${this.formatTemp(day.tempMax)} / ${this.formatTemp(day.tempMin)}`,
      rainChance: day.rainChance,
      wind: `${Math.round(day.windSpeed)} ${this.windUnit}`,
      humidity: day.humidity
    };
  }

  closeDetail(): void {
    this.selectedDetail = undefined;
  }

  trackByLocation(_: number, location: SavedLocation): string {
    return `${location.lat}-${location.lon}`;
  }

  trackByForecastDay(_: number, item: ForecastDay): string {
    return item.date;
  }

  trackByHour(_: number, item: HourlyForecast): string {
    return `${item.time}-${item.temp}`;
  }

  locationLabel(location: GeoLocation): string {
    return [location.name, location.state, location.country].filter(Boolean).join(', ');
  }

  weatherIconClass(icon?: string, main?: string): string {
    const prefix = icon?.slice(0, 2);
    if (prefix && this.weatherIconMap[prefix]) {
      return this.weatherIconMap[prefix];
    }

    const condition = main?.toLowerCase() ?? '';
    if (condition.includes('thunder')) {
      return 'fa-cloud-bolt';
    }
    if (condition.includes('rain') || condition.includes('drizzle')) {
      return 'fa-cloud-showers-heavy';
    }
    if (condition.includes('snow')) {
      return 'fa-snowflake';
    }
    if (condition.includes('mist') || condition.includes('fog') || condition.includes('haze')) {
      return 'fa-smog';
    }
    if (condition.includes('cloud')) {
      return 'fa-cloud';
    }
    return 'fa-sun';
  }

  formatTemp(value?: number): string {
    return formatTemperature(value, this.unit);
  }

  get unitSymbol(): string {
    return this.unit === 'imperial' ? 'F' : 'C';
  }

  get windUnit(): string {
    return WIND_UNIT[this.unit];
  }

  get themeLabel(): string {
    return this.themeMode === 'dark' ? 'Light mode' : 'Dark mode';
  }

  get currentWeather() {
    return this.weatherData?.weather?.[0];
  }

  get currentSavedLocation(): SavedLocation {
    return {
      name: this.weatherData?.name ?? 'Unknown',
      country: this.weatherData?.sys?.country,
      lat: this.weatherData?.coord?.lat ?? 0,
      lon: this.weatherData?.coord?.lon ?? 0
    };
  }

  get isFavorite(): boolean {
    return this.weatherData ? this.favorites.some(item => this.sameLocation(item, this.currentSavedLocation)) : false;
  }

  get windDirection(): string {
    return formatWindDirection(this.weatherData?.wind?.deg);
  }

  get visibility(): string {
    return formatDistance(this.weatherData?.visibility, this.unit);
  }

  get formattedSunrise(): string {
    return this.weatherData ? formatTime(this.weatherData.sys.sunrise, this.weatherData.timezone) : '--';
  }

  get formattedSunset(): string {
    return this.weatherData ? formatTime(this.weatherData.sys.sunset, this.weatherData.timezone) : '--';
  }

  get daylightDuration(): string {
    if (!this.weatherData) {
      return '--';
    }
    const seconds = Math.max(this.weatherData.sys.sunset - this.weatherData.sys.sunrise, 0);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  get dayProgress(): number {
    if (!this.weatherData) {
      return 0;
    }
    const now = Math.floor(Date.now() / 1000);
    const { sunrise, sunset } = this.weatherData.sys;
    return Math.max(0, Math.min(100, Math.round(((now - sunrise) / ((sunset - sunrise) || 1)) * 100)));
  }

  get rainVolume(): string {
    const rain = this.weatherData?.rain?.['1h'] ?? this.weatherData?.rain?.['3h'] ?? this.weatherData?.snow?.['1h'] ?? this.weatherData?.snow?.['3h'];
    return typeof rain === 'number' ? `${rain.toFixed(1)} mm` : 'None';
  }

  get nextRainChance(): number {
    return Math.max(...this.hourlyForecast.slice(0, 4).map(item => item.rainChance), 0);
  }

  get aqiLabel(): string {
    return getAqiLabel(this.airQuality?.main?.aqi);
  }

  get aqiTone(): string {
    return getAqiTone(this.airQuality?.main?.aqi);
  }

  get hasDashboard(): boolean {
    return !!this.weatherData && !this.loading;
  }

  get comfortScore(): number {
    if (!this.weatherData) {
      return 0;
    }

    const temp = this.weatherData.main.temp;
    const humidity = this.weatherData.main.humidity;
    const wind = this.weatherData.wind.speed;
    const idealTemp = this.unit === 'imperial' ? 72 : 22;
    const tempPenalty = Math.min(Math.abs(temp - idealTemp) * 2, 45);
    const humidityPenalty = Math.max(humidity - 55, 0) * 0.35;
    const windPenalty = Math.max(wind - (this.unit === 'imperial' ? 12 : 5), 0) * 1.2;

    return Math.max(0, Math.min(100, Math.round(100 - tempPenalty - humidityPenalty - windPenalty - this.nextRainChance * 0.25)));
  }

  get commuteRisk(): string {
    if (this.nextRainChance >= 70 || this.currentWeather?.main?.toLowerCase().includes('storm')) {
      return 'High';
    }
    if (this.nextRainChance >= 35 || (this.weatherData?.wind?.speed ?? 0) > (this.unit === 'imperial' ? 20 : 9)) {
      return 'Moderate';
    }
    return 'Low';
  }

  get outdoorScore(): string {
    if (this.comfortScore >= 78) {
      return 'Excellent';
    }
    if (this.comfortScore >= 58) {
      return 'Good';
    }
    if (this.comfortScore >= 38) {
      return 'Limited';
    }
    return 'Poor';
  }

  get mapEmbedUrl(): SafeResourceUrl {
    const lat = this.weatherData?.coord?.lat ?? 27.9475;
    const lon = this.weatherData?.coord?.lon ?? -82.4584;
    const delta = 0.22;
    const url = `https://www.openstreetmap.org/export/embed.html?bbox=${lon - delta}%2C${lat - delta}%2C${lon + delta}%2C${lat + delta}&layer=mapnik&marker=${lat}%2C${lon}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  get coordinateLabel(): string {
    if (!this.weatherData) {
      return '--';
    }

    return `${this.weatherData.coord.lat.toFixed(2)}, ${this.weatherData.coord.lon.toFixed(2)}`;
  }

  get timezoneLabel(): string {
    if (!this.weatherData) {
      return '--';
    }

    const hours = this.weatherData.timezone / 3600;
    return `UTC${hours >= 0 ? '+' : ''}${hours}`;
  }

  get bestOutdoorWindow(): string {
    if (!this.hourlyForecast.length) {
      return 'Use the hourly forecast once live data is available.';
    }

    const best = [...this.hourlyForecast].sort((a, b) => {
      const scoreA = a.rainChance + Math.abs(a.temp - (this.unit === 'imperial' ? 72 : 22)) * 2 + a.windSpeed;
      const scoreB = b.rainChance + Math.abs(b.temp - (this.unit === 'imperial' ? 72 : 22)) * 2 + b.windSpeed;
      return scoreA - scoreB;
    })[0];

    return `${best.time} looks best: ${this.formatTemp(best.temp)}, ${best.rainChance}% rain, ${Math.round(best.windSpeed)} ${this.windUnit} wind.`;
  }

  get showNoSuggestionState(): boolean {
    return this.searchQuery.length >= 2 && !this.suggestionsLoading && !this.suggestions.length;
  }

  get headerLocation(): string {
    if (!this.weatherData) {
      return 'Finding local forecast';
    }

    return [this.weatherData.name, this.weatherData.sys?.country].filter(Boolean).join(', ');
  }

  get headerCondition(): string {
    if (this.loading) {
      return 'Loading live conditions';
    }

    return this.currentWeather?.description ? `${this.formatTemp(this.weatherData?.main?.temp)} · ${this.currentWeather.description}` : 'Ready';
  }

  private listenForSearchSuggestions(): void {
    this.subscriptions.add(
      this.searchTerms$.pipe(
        debounceTime(250),
        distinctUntilChanged(),
        tap(query => {
          this.suggestionsLoading = query.length >= 2;
          if (query.length < 2) {
          this.suggestions = [];
        }
      }),
        switchMap(query => query.length < 2
          ? of([])
          : this.weatherService.searchLocations(query).pipe(catchError(() => of(this.getFallbackLocations(query))))
        )
      ).subscribe(locations => {
        this.suggestions = locations.length ? locations : this.getFallbackLocations(this.searchQuery);
        this.activeSuggestionIndex = this.suggestions.length ? 0 : -1;
        this.suggestionsLoading = false;
      })
    );
  }

  private loadDefaultLocation(): void {
    if (!navigator.geolocation) {
      this.lastTarget = this.getInitialTarget();
      this.search(this.lastTarget, false, true);
      return;
    }

    this.loading = true;
    navigator.geolocation.getCurrentPosition(
      position => {
        this.search({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          name: 'Current location'
        }, false, true);
      },
      () => {
        this.lastTarget = this.getInitialTarget();
        this.search(this.lastTarget, false, true);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 15 * 60 * 1000 }
    );
  }

  private search(target: SearchTarget, preserveInput = false, allowDemoFallback = false): void {
    this.lastTarget = target;
    this.loading = true;
    this.forecastLoading = true;
    this.errorMessage = '';
    this.alertNotice = '';
    this.chartReady = false;

    const current$ = typeof target === 'string'
      ? this.weatherService.getWeatherData(target, this.unit)
      : this.weatherService.getWeatherByCoords(target.lat, target.lon, this.unit);
    const forecast$ = typeof target === 'string'
      ? this.weatherService.getForecast(target, this.unit)
      : this.weatherService.getForecastByCoords(target.lat, target.lon, this.unit);

    this.subscriptions.add(
      forkJoin({
        current: current$,
        forecast: forecast$.pipe(catchError(() => of(undefined))),
      }).pipe(
        switchMap(({ current, forecast }) => forkJoin({
          current: of(current),
          forecast: of(forecast),
          airQuality: this.weatherService.getAirQuality(current.coord.lat, current.coord.lon).pipe(catchError(() => of(undefined))),
          alerts: this.weatherService.getWeatherAlerts(current.coord.lat, current.coord.lon).pipe(catchError(() => of(undefined)))
        }))
      ).subscribe({
        next: ({ current, forecast, airQuality, alerts }) => {
          this.weatherData = current;
          this.airQuality = airQuality?.list?.[0];
          this.alerts = this.mapWeatherAlerts(alerts);
          this.alertNotice = this.alerts.length ? '' : this.alertNoticeFromResponse(alerts);
          this.processForecast(forecast);
          this.themeClass = `theme-${getWeatherMood(current)}`;
          this.insight = buildInsight(current, forecast?.list ?? [], this.airQuality, this.unit);
          this.saveDashboardCache();
          this.updateLocalTime();
          this.loading = false;
          this.forecastLoading = false;
          if (!preserveInput) {
            this.cityName = '';
          }
        },
        error: () => {
          this.handleSearchError(target, preserveInput, allowDemoFallback);
        }
      })
    );
  }

  private handleSearchError(target: SearchTarget, preserveInput: boolean, allowDemoFallback: boolean): void {
    this.loading = false;
    this.forecastLoading = false;

    if (this.weatherData) {
      return;
    }

    if (allowDemoFallback) {
      if (this.restoreDashboardCache()) {
        return;
      }

      this.weatherData = this.demoWeather();
      this.airQuality = {
        main: { aqi: 2 },
        components: { pm2_5: 6.4, pm10: 11.8, o3: 42.2, no2: 8.1 },
        dt: Math.floor(Date.now() / 1000)
      };
      this.processForecast(undefined);
      this.alerts = [];
      this.alertNotice = 'Xweather alerts are optional and not configured for demo mode.';
      this.themeClass = `theme-${getWeatherMood(this.weatherData)}`;
      this.insight = buildInsight(this.weatherData, [], this.airQuality, this.unit);
      this.updateLocalTime();
      return;
    }

    const targetLabel = typeof target === 'string' ? target : target.name;
    this.errorMessage = `Could not load "${targetLabel}". Check the spelling, try a nearby city, or use your current location.`;
    if (!preserveInput && typeof target === 'string') {
      this.cityName = target;
    }
  }

  private processForecast(response?: ForecastResponse): void {
    if (!response?.list?.length) {
      this.buildFallbackForecast();
      return;
    }

    const orderedForecast = [...response.list].sort((a, b) => a.dt - b.dt);

    this.hourlyForecast = orderedForecast.slice(0, 12).map(item => ({
      time: formatTime(item.dt, response.city.timezone),
      timestamp: item.dt,
      temp: item.main.temp,
      feelsLike: item.main.feels_like,
      icon: item.weather?.[0]?.icon ?? '',
      description: item.weather?.[0]?.description ?? 'Forecast',
      rainChance: Math.round((item.pop ?? 0) * 100),
      windSpeed: item.wind?.speed ?? 0,
      humidity: item.main.humidity,
      pressure: item.main.pressure,
      visibility: item.visibility
    }));

    const grouped = orderedForecast.reduce((days, item) => {
      const dayKey = new Date((item.dt + response.city.timezone) * 1000).toISOString().slice(0, 10);
      days.set(dayKey, [...(days.get(dayKey) ?? []), item]);
      return days;
    }, new Map<string, ForecastListItem[]>());

    const todayKey = new Date((Math.floor(Date.now() / 1000) + response.city.timezone) * 1000).toISOString().slice(0, 10);
    this.forecast = Array.from(grouped.entries())
      .filter(([date]) => date !== todayKey)
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .slice(0, 5)
      .map(([date, items]) => {
        const representative = items.find(item => item.dt_txt?.includes('12:00:00')) ?? items[Math.floor(items.length / 2)] ?? items[0];
        return {
          date,
          dayName: formatDay(representative.dt, response.city.timezone),
          icon: representative.weather?.[0]?.icon ?? '',
          description: representative.weather?.[0]?.description ?? 'Forecast',
          tempMin: Math.min(...items.map(item => item.main.temp_min)),
          tempMax: Math.max(...items.map(item => item.main.temp_max)),
          humidity: Math.round(items.reduce((sum, item) => sum + item.main.humidity, 0) / items.length),
          rainChance: Math.max(...items.map(item => Math.round((item.pop ?? 0) * 100)), 0),
          windSpeed: Math.max(...items.map(item => item.wind?.speed ?? 0), 0)
        };
      });

    this.buildHourlyChart();
  }

  private buildFallbackForecast(): void {
    if (!this.weatherData) {
      this.forecast = [];
      this.hourlyForecast = [];
      this.hourlyChartData = { labels: [], datasets: [] };
      this.chartReady = false;
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    this.hourlyForecast = Array.from({ length: 8 }, (_, index) => {
      const hourOffset = (index + 1) * 3;
      const tempShift = Math.sin(index / 2) * 2;
      return {
        time: formatTime(now + hourOffset * 3600, this.weatherData?.timezone ?? 0),
        timestamp: now + hourOffset * 3600,
        temp: this.weatherData!.main.temp + tempShift,
        feelsLike: this.weatherData!.main.feels_like + tempShift,
        icon: this.currentWeather?.icon ?? '02d',
        description: this.currentWeather?.description ?? 'Current trend',
        rainChance: this.weatherData?.rain || this.weatherData?.snow ? 40 : 10,
        windSpeed: this.weatherData!.wind.speed,
        humidity: this.weatherData!.main.humidity,
        pressure: this.weatherData!.main.pressure,
        visibility: this.weatherData!.visibility
      };
    });

    this.forecast = [];
    this.buildHourlyChart();
  }

  private buildHourlyChart(): void {
    const palette = this.chartPalette();
    this.hourlyChartData = {
      labels: this.hourlyForecast.map(item => item.time),
      datasets: [
        {
          label: 'Temperature',
          data: this.hourlyForecast.map(item => item.temp),
          borderColor: palette.temperature,
          backgroundColor: palette.temperatureFill,
          fill: true,
          tension: 0.42,
          pointRadius: 3,
          pointHoverRadius: 6
        },
        {
          label: 'Rain chance',
          data: this.hourlyForecast.map(item => item.rainChance),
          borderColor: palette.rain,
          backgroundColor: palette.rainFill,
          fill: true,
          tension: 0.42,
          pointRadius: 3,
          pointHoverRadius: 6
        }
      ]
    };
    this.applyChartTheme();
    this.chartReady = true;
  }

  private updateLocalTime(): void {
    if (!this.weatherData) {
      this.localTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      return;
    }

    const utcSeconds = Math.floor(Date.now() / 1000);
    this.localTime = formatTime(utcSeconds, this.weatherData.timezone);
  }

  private loadPreferences(): void {
    this.unit = (localStorage.getItem('weatherUnit') as WeatherUnit) || 'imperial';
    this.themeMode = (localStorage.getItem('weatherTheme') as ThemeMode) || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    this.favorites = this.readLocations('weatherFavorites');
    this.applyTheme();
  }

  private getInitialTarget(): SearchTarget {
    return this.favorites[0] || 'Tampa';
  }

  private applyTheme(): void {
    document.body.classList.toggle('light-theme', this.themeMode === 'light');
    this.applyChartTheme();
  }

  private applyChartTheme(): void {
    const palette = this.chartPalette();
    this.hourlyChartOptions = {
      ...this.hourlyChartOptions,
      plugins: {
        ...this.hourlyChartOptions.plugins,
        legend: {
          display: true,
          labels: { color: palette.text, boxWidth: 10, usePointStyle: true }
        }
      },
      scales: {
        x: {
          ticks: { color: palette.muted },
          grid: { display: false }
        },
        y: {
          ticks: { color: palette.muted },
          grid: { color: palette.grid }
        }
      }
    };
  }

  private chartPalette(): {
    text: string;
    muted: string;
    grid: string;
    temperature: string;
    temperatureFill: string;
    rain: string;
    rainFill: string;
  } {
    return this.themeMode === 'light'
      ? {
        text: '#101a27',
        muted: '#627084',
        grid: 'rgba(96, 114, 125, 0.18)',
        temperature: '#0f9f97',
        temperatureFill: 'rgba(15, 159, 151, 0.16)',
        rain: '#4c63c7',
        rainFill: 'rgba(76, 99, 199, 0.13)'
      }
      : {
        text: '#e8f6f7',
        muted: '#9eb3bd',
        grid: 'rgba(158, 179, 189, 0.14)',
        temperature: '#4fd1c5',
        temperatureFill: 'rgba(79, 209, 197, 0.17)',
        rain: '#8aa8ff',
        rainFill: 'rgba(138, 168, 255, 0.13)'
      };
  }

  private readLocations(key: string): SavedLocation[] {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) ?? '[]') as SavedLocation[];
      return Array.isArray(parsed) ? parsed.filter(item => item.name && Number.isFinite(item.lat) && Number.isFinite(item.lon)) : [];
    } catch {
      return [];
    }
  }

  private persistLocations(key: string, locations: SavedLocation[]): void {
    localStorage.setItem(key, JSON.stringify(locations));
  }

  private getFallbackLocations(query: string): GeoLocation[] {
    const normalized = query.trim().toLowerCase();
    if (normalized.length < 2) {
      return [];
    }

    return this.fallbackLocations
      .filter(location => {
        const searchable = [
          location.name,
          location.state,
          location.country,
          this.locationLabel(location)
        ].filter(Boolean).join(' ').toLowerCase();

        return searchable.includes(normalized) || normalized.includes(location.name.toLowerCase());
      })
      .slice(0, 6);
  }

  private saveDashboardCache(): void {
    if (!this.weatherData) {
      return;
    }

    localStorage.setItem('weatherDashboardCache', JSON.stringify({
      weatherData: this.weatherData,
      forecast: this.forecast,
      hourlyForecast: this.hourlyForecast,
      airQuality: this.airQuality,
      alerts: this.alerts,
      unit: this.unit,
      cachedAt: Date.now()
    }));
  }

  private restoreDashboardCache(): boolean {
    try {
      const cached = JSON.parse(localStorage.getItem('weatherDashboardCache') || '{}') as {
        weatherData?: WeatherData;
        forecast?: ForecastDay[];
        hourlyForecast?: HourlyForecast[];
        airQuality?: AirQualityItem;
        alerts?: WeatherAlert[];
        unit?: WeatherUnit;
        cachedAt?: number;
      };

      if (!cached.weatherData || !cached.cachedAt) {
        return false;
      }

      this.weatherData = cached.weatherData;
      this.forecast = cached.forecast || [];
      this.hourlyForecast = cached.hourlyForecast || [];
      this.airQuality = cached.airQuality;
      this.alerts = cached.alerts || [];
      this.unit = cached.unit || this.unit;
      this.themeClass = `theme-${getWeatherMood(this.weatherData)}`;
      this.insight = buildInsight(this.weatherData, [], this.airQuality, this.unit);
      if (this.hourlyForecast.length) {
        this.buildHourlyChart();
      } else {
        this.chartReady = false;
      }
      this.updateLocalTime();
      return true;
    } catch {
      return false;
    }
  }

  private sameLocation(a: SavedLocation, b: SavedLocation): boolean {
    return Math.abs(a.lat - b.lat) < 0.01 && Math.abs(a.lon - b.lon) < 0.01;
  }

  private mapWeatherAlerts(response?: XweatherAlertsResponse): WeatherAlert[] {
    if (!response?.response?.length) {
      return [];
    }

    return response.response.map((item, index) => ({
      id: item.id || `${item.details?.type || 'alert'}-${index}`,
      title: item.details?.name || 'Weather Alert',
      type: item.details?.type || 'Alert',
      severity: this.alertSeverity(item.details?.color),
      color: item.details?.color,
      source: item.details?.source,
      body: item.details?.bodyFull || item.details?.body,
      issued: item.timestamps?.issued,
      expires: item.timestamps?.expires
    }));
  }

  private alertNoticeFromResponse(response?: XweatherAlertsResponse): string {
    if (!response) {
      return 'Xweather alerts are temporarily unavailable.';
    }

    if (response.success === false) {
      return response.error?.description || 'Xweather alerts are optional. Add Xweather credentials to enable live severe weather alerts.';
    }

    return 'No active severe weather alerts for this location.';
  }

  private alertSeverity(color?: string): string {
    const normalized = color?.toLowerCase() || '';
    if (['red', 'purple', 'magenta'].includes(normalized)) {
      return 'Extreme';
    }
    if (['orange'].includes(normalized)) {
      return 'Severe';
    }
    if (['yellow'].includes(normalized)) {
      return 'Moderate';
    }
    return 'Advisory';
  }

  private demoWeather(): WeatherData {
    const now = Math.floor(Date.now() / 1000);
    return {
      coord: { lat: 27.9475, lon: -82.4584 },
      weather: [{ id: 801, main: 'Clouds', description: 'few clouds', icon: '02d' }],
      base: 'demo',
      main: {
        temp: this.unit === 'imperial' ? 79 : 26,
        feels_like: this.unit === 'imperial' ? 80 : 27,
        temp_min: this.unit === 'imperial' ? 73 : 23,
        temp_max: this.unit === 'imperial' ? 84 : 29,
        pressure: 1013,
        humidity: 64
      },
      visibility: 10000,
      wind: { speed: this.unit === 'imperial' ? 8 : 3.6, deg: 94, gust: this.unit === 'imperial' ? 14 : 6.2 },
      clouds: { all: 22 },
      dt: now,
      sys: {
        country: 'US',
        sunrise: now - 9000,
        sunset: now + 17000
      },
      timezone: -14400,
      id: 4174757,
      name: 'Tampa',
      cod: 200
    };
  }
}
