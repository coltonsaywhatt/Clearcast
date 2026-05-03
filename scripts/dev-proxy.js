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

  if (isOpenWeatherEndpoint(url)) {
    url.searchParams.set('appid', process.env.WEATHER_API_KEY_HEADER_VALUE || '');
  }

  return proxyJson(url, res, isOpenWeatherEndpoint(url) ? {} : providerHeaders());
}

function proxyXweatherAlerts(requestUrl, res) {
  const lat = requestUrl.searchParams.get('lat');
  const lon = requestUrl.searchParams.get('lon');

  if (!lat || !lon) {
    return sendJson(res, 400, { message: 'Latitude and longitude are required.' });
  }

  if (!process.env.WEATHER_API_KEY_HEADER_VALUE) {
    return sendJson(res, 200, { success: false, response: [], notice: 'OpenWeather alerts are not configured.' });
  }

  const url = new URL('https://api.openweathermap.org/data/3.0/onecall');
  url.searchParams.set('lat', lat);
  url.searchParams.set('lon', lon);
  url.searchParams.set('appid', process.env.WEATHER_API_KEY_HEADER_VALUE);
  url.searchParams.set('exclude', 'minutely,hourly,daily');

  return proxyJson(url, res, {}, mapOpenWeatherAlerts);
}

function proxyJson(url, res, headers = {}, transform) {
  https.get(url, { headers }, upstream => {
    let body = '';
    upstream.on('data', chunk => {
      body += chunk;
    });
    upstream.on('end', () => {
      const payload = transform ? transform(body, upstream.statusCode || 502) : body;
      res.writeHead(transform ? 200 : upstream.statusCode || 502, {
        'content-type': upstream.headers['content-type'] || 'application/json',
        'cache-control': 'no-store',
      });
      res.end(payload);
    });
  }).on('error', () => {
    sendJson(res, 502, { message: 'Unable to reach upstream weather service.' });
  });
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function isOpenWeatherEndpoint(url) {
  return url.hostname.includes('openweathermap.org');
}

function providerHeaders() {
  const keyHeader = process.env.WEATHER_API_KEY_HEADER_NAME || 'X-RapidAPI-Key';
  const hostHeader = process.env.WEATHER_API_HOST_HEADER_NAME || 'X-RapidAPI-Host';
  return {
    [hostHeader]: process.env.WEATHER_API_HOST_HEADER_VALUE || '',
    [keyHeader]: process.env.WEATHER_API_KEY_HEADER_VALUE || '',
  };
}

function mapOpenWeatherAlerts(body, statusCode) {
  if (statusCode >= 400) {
    return JSON.stringify({ success: false, response: [], error: safeJson(body) });
  }

  const parsed = safeJson(body);
  const alerts = Array.isArray(parsed.alerts) ? parsed.alerts : [];
  return JSON.stringify({
    success: true,
    response: alerts.map((alert, index) => ({
      id: `${alert.sender_name || 'openweather'}-${alert.start || index}`,
      details: {
        name: alert.event || 'Weather Alert',
        type: alert.event || 'Alert',
        color: 'yellow',
        source: alert.sender_name || 'OpenWeather',
        body: alert.description,
        bodyFull: alert.description,
      },
      timestamps: {
        issued: alert.start,
        begins: alert.start,
        expires: alert.end,
      },
    })),
  });
}

function safeJson(body) {
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}
