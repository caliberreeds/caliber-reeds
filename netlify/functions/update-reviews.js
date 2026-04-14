const { google } = require('googleapis');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body);

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    // Verify password
    const passResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Settings!B5'
    });
    const correctPassword = (passResponse.data.values || [['']])[0][0];
    if (data.password !== correctPassword) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const { action } = data;

    // ── Add new review ──
    if (action === 'add') {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Reviews!A:E',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            data.name  || '',
            data.role  || '',
            data.quote || '',
            'TRUE'
          ]]
        }
      });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // ── Update existing review ──
    if (action === 'update') {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Reviews!A${data.index}:D${data.index}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            data.name  || '',
            data.role  || '',
            data.quote || '',
            data.active ? 'TRUE' : 'FALSE'
          ]]
        }
      });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // ── Toggle active status ──
    if (action === 'toggle') {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Reviews!D${data.index}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[data.active ? 'TRUE' : 'FALSE']] }
      });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // ── Delete review (clear row) ──
    if (action === 'delete') {
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `Reviews!A${data.index}:D${data.index}`
      });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};