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

    // Get products
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Products!A2:F'
    });

    const rows = response.data.values || [];
    const products = rows
      .filter(row => row[0]) // must have a name
      .map((row, index) => ({
        index:       index + 2, // sheet row number
        name:        row[0] || "",
        price:       parseFloat(row[1]) || 0,
        category:    row[2] || "",
        description: row[3] || "",
        active:    (row[4] || "").toString().toUpperCase() === "TRUE",
        imageUrl:  row[5] || ""
      }));

    // Get shipping options from Settings
    const settingsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Settings!A2:B10'
    });

    const settingsRows = settingsResponse.data.values || [];
    const settings = {};
    settingsRows.forEach(row => {
      if (row[0]) settings[row[0]] = row[1];
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        products,
        shipping: [
          {
            label: settings.shipping_1_label || "USPS Ground Advantage",
            price: parseFloat(settings.shipping_1_price) || 5.50
          },
          {
            label: settings.shipping_2_label || "USPS Priority Mail",
            price: parseFloat(settings.shipping_2_price) || 12
          }
        ]
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
