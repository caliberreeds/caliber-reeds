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

    // ── Add new product ──
    if (data.action === 'add') {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Products!A:F',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            data.name,
            data.price,
            data.category,
            data.description,
            'TRUE',
            data.imageUrl || ""
          ]]
        }
      });
    }

    // ── Update existing product ──
    if (data.action === 'update') {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Products!A${data.index}:F${data.index}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            data.name,
            data.price,
            data.category,
            data.description,
            data.active ? 'TRUE' : 'FALSE',
            data.imageUrl || ""
          ]]
        }
      });
    }

    // ── Update shipping ──
    if (data.action === 'update_shipping') {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: [
            { range: 'Settings!B6', values: [[data.shipping_1_label]] },
            { range: 'Settings!B7', values: [[data.shipping_1_price]] },
            { range: 'Settings!B8', values: [[data.shipping_2_label]] },
            { range: 'Settings!B9', values: [[data.shipping_2_price]] }
          ]
        }
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
