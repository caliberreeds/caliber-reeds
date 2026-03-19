const { google } = require('googleapis');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
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

    // ── GET settings ──
    if (event.httpMethod === 'GET') {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Settings!A2:B10'
      });

      const rows = response.data.values || [];
      const settings = {};
      rows.forEach(row => {
        if (row[0]) settings[row[0]] = row[1];
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(settings)
      };
    }

    // ── POST (update settings) ──
    if (event.httpMethod === 'POST') {
      const data = JSON.parse(event.body);

      // Verify password
      const passResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Settings!B5'
      });
      const correctPassword = (passResponse.data.values || [['']])[0][0];

      if (data.password !== correctPassword) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Incorrect password' })
        };
      }

      // Update settings
      const updates = [];

      if (data.cart_paused !== undefined) {
        updates.push({
          range: 'Settings!B2',
          values: [[data.cart_paused]]
        });
      }
      if (data.pause_reason !== undefined) {
        updates.push({
          range: 'Settings!B3',
          values: [[data.pause_reason]]
        });
      }
      if (data.processing_time !== undefined) {
        updates.push({
          range: 'Settings!B4',
          values: [[data.processing_time]]
        });
      }

      if (updates.length > 0) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: {
            valueInputOption: 'RAW',
            data: updates
          }
        });
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ result: 'success' })
      };
    }

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
