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

  if (!process.env.XWEATHER_CLIENT_ID || !process.env.XWEATHER_CLIENT_SECRET) {
    return json(200, { success: false, response: [], notice: 'Xweather alerts are not configured.' });
  }

  const url = new URL(`https://data.api.xweather.com/alerts/${lat},${lon}`);
  url.searchParams.set('client_id', process.env.XWEATHER_CLIENT_ID);
  url.searchParams.set('client_secret', process.env.XWEATHER_CLIENT_SECRET);
  url.searchParams.set('limit', '6');

  try {
    const response = await fetch(url);
    const body = await response.text();

    return {
      statusCode: response.status,
      headers: {
        'content-type': response.headers.get('content-type') || 'application/json',
        'cache-control': 'public, max-age=180',
      },
      body,
    };
  } catch {
    return json(502, { success: false, response: [], message: 'Unable to reach Xweather alerts.' });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}
