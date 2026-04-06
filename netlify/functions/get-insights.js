const { google } = require('googleapis');
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  try {
    const params = event.queryStringParameters || {};
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const passResponse = await sheets.spreadsheets.values.get({
      spreadsheetId, range: 'Settings!B5'
    });
    const correctPassword = (passResponse.data.values || [['']])[0][0];
    if (params.password !== correctPassword) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Incorrect password' }) };
    }
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId, range: 'Orders!A2:Q'
    });
    const rows = response.data.values || [];
    const orders = rows.map(row => ({
      orderNumber: row[0] || "",
      date:        row[1] || "",
      items:       row[2] || "",
      shipping:    parseFloat(row[3]) || 0,
      total:       parseFloat(row[4]) || 0,
      name:        row[5] || "",
      payMethod:   row[14] || "",
      status:      row[10] || "",
      refundInfo:  row[16] || ""
    }));
    return { statusCode: 200, headers, body: JSON.stringify(orders) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
