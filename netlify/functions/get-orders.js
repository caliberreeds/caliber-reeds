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
    // Verify password
    const params = event.queryStringParameters || {};
    const password = params.password || "";
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
    if (password !== correctPassword) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Incorrect password' })
      };
    }
    // Get orders
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Orders!A2:O'
    });
    const rows = response.data.values || [];
    const orders = rows.map(row => ({
      orderNumber:     row[0]  || "",
      date:            row[1]  || "",
      items:           row[2]  || "",
      shipping:        row[3]  || "",
      total:           row[4]  || "",
      name:            row[5]  || "",
      email:           row[6]  || "",
      address:         row[7]  || "",
      notes:           row[8]  || "",
      packingSlip:     row[9]  || "",
      status:          row[10] || "",
      labelUrl:        row[11] || "",
      tracking:        row[12] || "",
      paymentIntentId: row[13] || "",
      payMethod:       row[14] || ""
    }));
    // Return newest first
    orders.reverse();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(orders)
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
