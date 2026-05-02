const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');
const envExamplePath = path.join(rootDir, '.env.example');
const usingLocalEnv = fs.existsSync(envPath);

if (usingLocalEnv) {
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.error('Failed to load .env:', result.error);
    process.exit(1);
  }
} else if (fs.existsSync(envExamplePath)) {
  dotenv.config({ path: envExamplePath });
}

const requiredKeys = [
  'WEATHER_API_PROXY_URL'
];

const missingKeys = requiredKeys.filter(key => !process.env[key]);
if (missingKeys.length) {
  console.error(`Missing required .env keys: ${missingKeys.join(', ')}`);
  process.exit(1);
}

const generatedEnvDir = path.join(rootDir, 'src', 'app');
if (!fs.existsSync(generatedEnvDir)) {
  fs.mkdirSync(generatedEnvDir, { recursive: true });
}

const generateFile = (filename, production) => {
  const config = {
    production,
    weatherApiProxyUrl: process.env.WEATHER_API_PROXY_URL || '',
    xweatherAlertsProxyUrl: process.env.XWEATHER_ALERTS_PROXY_URL || '',
    weatherApiBaseUrl: process.env.WEATHER_API_BASE_URL,
    weatherForecastApiUrl: process.env.WEATHER_FORECAST_API_URL,
    weatherAirPollutionApiUrl: process.env.WEATHER_AIR_POLLUTION_API_URL,
    weatherGeocodingApiUrl: process.env.WEATHER_GEOCODING_API_URL,
    weatherApiHostHeaderName: process.env.WEATHER_API_HOST_HEADER_NAME,
    weatherApiHostHeaderValue: process.env.WEATHER_API_HOST_HEADER_VALUE,
    weatherApiKeyHeaderName: process.env.WEATHER_API_KEY_HEADER_NAME,
    weatherApiKeyHeaderValue: ''
  };

  const content = `export const environment = ${JSON.stringify(config, null, 2)};\n`;
  fs.writeFileSync(path.join(generatedEnvDir, filename), content, 'utf8');
};

generateFile('app.environment.ts', process.env.NODE_ENV === 'production');
console.log(`Generated environment files from ${usingLocalEnv ? '.env' : 'process environment or .env.example'} successfully.`);
