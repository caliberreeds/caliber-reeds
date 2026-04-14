const { google } = require('googleapis');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    const params = event.queryStringParameters || {};
    const includeAll = params.all === 'true';
    const password = params.password || '';

    if (includeAll) {
      const passResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Settings!B5'
      });
      const correctPassword = (passResponse.data.values || [['']])[0][0];
      if (password !== correctPassword) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
      }
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Reviews!A2:E'
    });

    const rows = response.data.values || [];
    const reviews = rows.map((row, index) => ({
      index:  index + 2,
      name:   row[0] || '',
      role:   row[1] || '',
      quote:  row[2] || '',
      active: (row[3] || '').toString().toUpperCase() === 'TRUE'
    })).filter(r => r.name || r.quote);

    const filtered = includeAll ? reviews : reviews.filter(r => r.active);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reviews: filtered })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};