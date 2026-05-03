try {
  require('dotenv').config();
} catch {
  // Netlify provides runtime env vars directly; dotenv is only needed for local function runs.
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { message: 'Method not allowed' });
  }

  const lat = event.queryStringParameters?.lat;
  const lon = event.queryStringParameters?.lon;

  if (!lat || !lon) {
    return json(400, { message: 'Latitude and longitude are required.' });
  }

  if (!process.env.WEATHER_API_KEY_HEADER_VALUE) {
    return json(200, { success: false, response: [], notice: 'OpenWeather alerts are not configured.' });
  }

  const url = new URL('https://api.openweathermap.org/data/3.0/onecall');
  url.searchParams.set('lat', lat);
  url.searchParams.set('lon', lon);
  url.searchParams.set('appid', process.env.WEATHER_API_KEY_HEADER_VALUE);
  url.searchParams.set('exclude', 'minutely,hourly,daily');

  try {
    const response = await fetch(url);
    const body = await response.text();
    const payload = response.ok
      ? mapOpenWeatherAlerts(body)
      : JSON.stringify({ success: false, response: [], error: safeJson(body) });

    return {
      statusCode: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=180',
      },
      body: payload,
    };
  } catch {
    return json(502, { success: false, response: [], message: 'Unable to reach OpenWeather alerts.' });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function mapOpenWeatherAlerts(body) {
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
