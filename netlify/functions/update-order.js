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
    const rowIndex = rows.findIndex(row => row[0] && row[0].toString() === data.orderNumber.toString());

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

      // Color code the cell
      const colorMap = {
        "New - Unpaid":          { red: 0.745, green: 0.059, blue: 0.020 },
        "New - Paid":            { red: 0.000, green: 0.486, blue: 0.286 },
        "In Progress - Unpaid":  { red: 0.745, green: 0.059, blue: 0.020 },
        "In Progress - Paid":    { red: 0.000, green: 0.486, blue: 0.286 },
        "Shipped":               { red: 0.027, green: 0.298, blue: 0.671 },
        "Cancelled":             { red: 0.239, green: 0.239, blue: 0.239 }
      };

      const bgColor = colorMap[data.status] || { red: 1, green: 1, blue: 1 };
      const fontColor = { red: 1, green: 1, blue: 1 };

      // Get the sheet ID first
      const spreadsheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
      const ordersSheet = spreadsheetMeta.data.sheets.find(s => s.properties.title === "Orders");
      const sheetId = ordersSheet.properties.sheetId;

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            repeatCell: {
              range: {
                sheetId:          sheetId,
                startRowIndex:    sheetRow - 1,
                endRowIndex:      sheetRow,
                startColumnIndex: 10,
                endColumnIndex:   11
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: bgColor,
                  textFormat: { foregroundColor: fontColor }
                }
              },
              fields: "userEnteredFormat(backgroundColor,textFormat)"
            }
          }]
        }
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ result: 'success' })
    };

  } catch (err) {
    console.log("UPDATE-ORDER ERROR:", err.message);
    console.log("UPDATE-ORDER STACK:", err.stack);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
