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
    const data = JSON.parse(event.body);

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    // Check password
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

    // Find the row for this order number
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Orders!A2:A'
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0].toString() === data.orderNumber.toString());

    if (rowIndex === -1) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Order not found' })
      };
    }

    const sheetRow = rowIndex + 2; // +2 for header row and 0-index

    // Update status in column K
    if (data.status !== undefined) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Orders!K${sheetRow}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[data.status]] }
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ result: 'success' })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
