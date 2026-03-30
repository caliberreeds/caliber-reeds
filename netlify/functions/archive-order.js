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
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    // Find the row for this order
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Orders!A2:P'
    });
    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] && row[0].toString() === data.orderNumber.toString());

    if (rowIndex === -1) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Order not found' }) };
    }

    const sheetRow = rowIndex + 2;
    const orderRow = rows[rowIndex];

    // Copy row to Archive tab
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Archive!A:P',
      valueInputOption: 'RAW',
      requestBody: { values: [orderRow] }
    });

    // Delete row from Orders tab
    const sheetsClient = await auth.getClient();
    const sheetIdResponse = await sheets.spreadsheets.get({ spreadsheetId });
    const ordersSheet = sheetIdResponse.data.sheets.find(s => s.properties.title === 'Orders');
    const ordersSheetId = ordersSheet.properties.sheetId;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId:    ordersSheetId,
              dimension:  'ROWS',
              startIndex: sheetRow - 1,
              endIndex:   sheetRow
            }
          }
        }]
      }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};