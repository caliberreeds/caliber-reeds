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
      range: 'Orders!A2:A'
    });
    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] && row[0].toString() === data.orderNumber.toString());

    if (rowIndex === -1) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Order not found' }) };
    }

    const sheetRow = rowIndex + 2;

    // Write tracking number to column M
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Orders!M${sheetRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[data.tracking]] }
    });

    // Call Apps Script to send tracking email
    const SCRIPT_URL = process.env.APPS_SCRIPT_URL;
    try {
      // Get order details for email
      const orderDetails = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `Orders!A${sheetRow}:H${sheetRow}`
      });
      const orderRow = (orderDetails.data.values || [[]])[0];
      const customerName  = orderRow[5] || "";
      const customerEmail = orderRow[6] || "";
      const items         = orderRow[2] || "";
      const address       = orderRow[7] || "";

      await fetch(SCRIPT_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action:        "sendTrackingEmail",
          orderNumber:   data.orderNumber,
          customerName:  customerName,
          customerEmail: customerEmail,
          items:         items,
          address:       address,
          trackingNumber: data.tracking
        })
      });
    } catch (err) {
      console.warn("Could not send tracking email:", err);
    }

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