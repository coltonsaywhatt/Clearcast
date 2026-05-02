const ENDPOINTS = {
  weather: process.env.WEATHER_API_BASE_URL || 'https://rapidweather.p.rapidapi.com/data/2.5/weather',
  forecast: process.env.WEATHER_FORECAST_API_URL || 'https://rapidweather.p.rapidapi.com/data/2.5/forecast',
  airPollution: process.env.WEATHER_AIR_POLLUTION_API_URL || 'https://rapidweather.p.rapidapi.com/data/2.5/air_pollution',
  geocoding: process.env.WEATHER_GEOCODING_API_URL || 'https://rapidweather.p.rapidapi.com/geo/1.0/direct',
};

const ALLOWED_PARAMS = new Set(['q', 'lat', 'lon', 'units', 'lang', 'limit']);

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { message: 'Method not allowed' });
  }

  const resource = event.queryStringParameters?.resource || 'weather';
  const endpoint = ENDPOINTS[resource];

  if (!endpoint) {
    return json(400, { message: 'Unsupported weather resource.' });
  }

  if (!process.env.WEATHER_API_KEY_HEADER_VALUE) {
    return json(500, { message: 'Weather API key is not configured.' });
  }

  const url = new URL(endpoint);
  Object.entries(event.queryStringParameters || {}).forEach(([key, value]) => {
    if (ALLOWED_PARAMS.has(key) && value) {
      url.searchParams.set(key, value);
    }
  });

  try {
    const response = await fetch(url, {
      headers: {
        [process.env.WEATHER_API_HOST_HEADER_NAME || 'X-RapidAPI-Host']: process.env.WEATHER_API_HOST_HEADER_VALUE || '',
        [process.env.WEATHER_API_KEY_HEADER_NAME || 'X-RapidAPI-Key']: process.env.WEATHER_API_KEY_HEADER_VALUE,
      },
    });

    const body = await response.text();
    return {
      statusCode: response.status,
      headers: {
        'content-type': response.headers.get('content-type') || 'application/json',
        'cache-control': resource === 'weather' ? 'public, max-age=120' : 'public, max-age=600',
      },
      body,
    };
  } catch {
    return json(502, { message: 'Unable to reach the weather provider.' });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}
