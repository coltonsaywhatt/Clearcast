const http = require('http');
const https = require('https');
const { URL } = require('url');
const dotenv = require('dotenv');

dotenv.config();

const PORT = Number(process.env.DEV_PROXY_PORT || 8787);

const WEATHER_ENDPOINTS = {
  weather: process.env.WEATHER_API_BASE_URL,
  forecast: process.env.WEATHER_FORECAST_API_URL,
  airPollution: process.env.WEATHER_AIR_POLLUTION_API_URL,
  geocoding: process.env.WEATHER_GEOCODING_API_URL,
};

const ALLOWED_PARAMS = new Set(['q', 'lat', 'lon', 'units', 'lang', 'limit']);

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', `http://localhost:${PORT}`);

  if (requestUrl.pathname === '/api/weather') {
    return proxyWeather(requestUrl, res);
  }

  if (requestUrl.pathname === '/api/xweather-alerts') {
    return proxyXweatherAlerts(requestUrl, res);
  }

  sendJson(res, 404, { message: 'Proxy route not found.' });
});

server.listen(PORT, () => {
  console.log(`Weather dev proxy listening on http://127.0.0.1:${PORT}`);
});

function proxyWeather(requestUrl, res) {
  const resource = requestUrl.searchParams.get('resource') || 'weather';
  const endpoint = WEATHER_ENDPOINTS[resource];

  if (!endpoint) {
    return sendJson(res, 400, { message: 'Unsupported weather resource.' });
  }

  const url = new URL(endpoint);
  requestUrl.searchParams.forEach((value, key) => {
    if (ALLOWED_PARAMS.has(key) && value) {
      url.searchParams.set(key, value);
    }
  });

  return proxyJson(url, res, {
    [process.env.WEATHER_API_HOST_HEADER_NAME || 'X-RapidAPI-Host']: process.env.WEATHER_API_HOST_HEADER_VALUE || '',
    [process.env.WEATHER_API_KEY_HEADER_NAME || 'X-RapidAPI-Key']: process.env.WEATHER_API_KEY_HEADER_VALUE || '',
  });
}

function proxyXweatherAlerts(requestUrl, res) {
  const lat = requestUrl.searchParams.get('lat');
  const lon = requestUrl.searchParams.get('lon');

  if (!lat || !lon) {
    return sendJson(res, 400, { message: 'Latitude and longitude are required.' });
  }

  if (!process.env.XWEATHER_CLIENT_ID || !process.env.XWEATHER_CLIENT_SECRET) {
    return sendJson(res, 200, { success: false, response: [], notice: 'Xweather alerts are not configured.' });
  }

  const url = new URL(`https://data.api.xweather.com/alerts/${lat},${lon}`);
  url.searchParams.set('client_id', process.env.XWEATHER_CLIENT_ID);
  url.searchParams.set('client_secret', process.env.XWEATHER_CLIENT_SECRET);
  url.searchParams.set('limit', '6');
  return proxyJson(url, res);
}

function proxyJson(url, res, headers = {}) {
  https.get(url, { headers }, upstream => {
    let body = '';
    upstream.on('data', chunk => {
      body += chunk;
    });
    upstream.on('end', () => {
      res.writeHead(upstream.statusCode || 502, {
        'content-type': upstream.headers['content-type'] || 'application/json',
        'cache-control': 'no-store',
      });
      res.end(body);
    });
  }).on('error', () => {
    sendJson(res, 502, { message: 'Unable to reach upstream weather service.' });
  });
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}
