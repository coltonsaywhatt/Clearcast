const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');
const envExamplePath = path.join(rootDir, '.env.example');

if (!fs.existsSync(envPath)) {
  console.error(`Missing .env file. Copy ${envExamplePath} to .env and add your API key.`);
  process.exit(1);
}

const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error('Failed to load .env:', result.error);
  process.exit(1);
}

const requiredKeys = [
  'WEATHER_API_BASE_URL',
  'WEATHER_FORECAST_API_URL',
  'WEATHER_AIR_POLLUTION_API_URL',
  'WEATHER_GEOCODING_API_URL',
  'WEATHER_API_HOST_HEADER_NAME',
  'WEATHER_API_HOST_HEADER_VALUE',
  'WEATHER_API_KEY_HEADER_NAME',
  'WEATHER_API_KEY_HEADER_VALUE'
];

const missingKeys = requiredKeys.filter(key => !process.env[key]);
if (missingKeys.length) {
  console.error(`Missing required .env keys: ${missingKeys.join(', ')}`);
  process.exit(1);
}

const generatedEnvDir = path.join(rootDir, 'src', 'environments');
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
    weatherApiKeyHeaderValue: process.env.WEATHER_API_PROXY_URL ? '' : process.env.WEATHER_API_KEY_HEADER_VALUE
  };

  const content = `export const environment = ${JSON.stringify(config, null, 2)};\n`;
  fs.writeFileSync(path.join(generatedEnvDir, filename), content, 'utf8');
};

generateFile('generated.environment.ts', false);
generateFile('generated.environment.prod.ts', true);
console.log('Generated environment files from .env successfully.');
