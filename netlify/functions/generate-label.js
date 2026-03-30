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

    // Auth
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

    const { orderNumber, name, address, shipping } = data;
    const SHIPPO_API_KEY = process.env.SHIPPO_API_KEY;

    // Read ship-from address from Settings sheet
    const shipFromResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Settings!A10:B15'
    });
    const shipFromRows = shipFromResponse.data.values || [];
    const shipFromSettings = {};
    shipFromRows.forEach(row => {
      if (row[0]) shipFromSettings[row[0]] = row[1] || "";
    });

    const SHIP_FROM = {
      name:    shipFromSettings.ship_from_name   || "",
      street1: shipFromSettings.ship_from_street || "",
      city:    shipFromSettings.ship_from_city   || "",
      state:   shipFromSettings.ship_from_state  || "",
      zip:     shipFromSettings.ship_from_zip    || "",
      country: "US",
      phone:   shipFromSettings.ship_from_phone  || "",
      email:   "caliberreeds@gmail.com"
    };

    // Parse address
    const firstComma = address.indexOf(",");
    const street1 = firstComma > -1 ? address.substring(0, firstComma).trim() : address.trim();
    const rest = firstComma > -1 ? address.substring(firstComma + 1).trim() : "";
    const match = rest.match(/^(.+),\s*([A-Z]{2})\s*(\d{5})/i);

    if (!match) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Could not parse address. Please check the address and try again.' })
      };
    }

    const toCity  = match[1].trim();
    const toState = match[2].toUpperCase();
    const toZip   = match[3];

    // Create Shippo shipment
    const shipmentRes = await fetch("https://api.goshippo.com/shipments/", {
      method: "POST",
      headers: {
        "Authorization": "ShippoToken " + SHIPPO_API_KEY,
        "Content-Type":  "application/json"
      },
      body: JSON.stringify({
        address_from: SHIP_FROM,
        address_to: {
          name:    name,
          street1: street1,
          city:    toCity,
          state:   toState,
          zip:     toZip,
          country: "US"
        },
        parcels: [{
          length: "6", width: "4", height: "2",
          distance_unit: "in",
          weight: "0.2", mass_unit: "lb"
        }],
        async: false
      })
    });

    const shipmentData = await shipmentRes.json();

    // Choose rate
    const preferPriority = parseFloat(shipping) >= 10;
    const uspsRates = (shipmentData.rates || []).filter(r =>
      r.provider && r.provider.toUpperCase() === "USPS"
    );
    const ratesToSearch = uspsRates.length > 0 ? uspsRates : (shipmentData.rates || []);
    const chosenRate = ratesToSearch.find(r =>
      preferPriority
        ? r.servicelevel.token.includes("priority")
        : r.servicelevel.token.includes("ground") || r.servicelevel.token.includes("first")
    ) || ratesToSearch[0];

    if (!chosenRate) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No matching rate found. Please generate label manually in Shippo.' })
      };
    }

    // Purchase label
    const transactionRes = await fetch("https://api.goshippo.com/transactions/", {
      method: "POST",
      headers: {
        "Authorization": "ShippoToken " + SHIPPO_API_KEY,
        "Content-Type":  "application/json"
      },
      body: JSON.stringify({
        rate:            chosenRate.object_id,
        label_file_type: "PDF",
        async:           false
      })
    });

    const transactionData = await transactionRes.json();

    if (!transactionData.label_url) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Label generation failed. Please try again or generate manually in Shippo.' })
      };
    }

    // Save label URL to column L in sheet
    const ordersResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Orders!A2:A'
    });
    const rows = ordersResponse.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] && row[0].toString() === orderNumber.toString());

    if (rowIndex !== -1) {
      const sheetRow = rowIndex + 2;
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Orders!L${sheetRow}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[transactionData.label_url]] }
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success:  true,
        labelUrl: transactionData.label_url
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