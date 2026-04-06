const Stripe = require('stripe');
const { google } = require('googleapis');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const { paymentIntentId, amount, orderNumber, reason, manualReference, paymentMethod, password, skipRefund } = JSON.parse(event.body);

    if (password !== process.env.ADMIN_PASSWORD) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    let refundId = "";
    let refundAmount = amount;

    // ── Sheet lookup ──
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    const ordersResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Orders!A2:A'
    });
    const rows = ordersResponse.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] && row[0].toString() === orderNumber.toString());
    const sheetRow = rowIndex !== -1 ? rowIndex + 2 : null;

    // ── Skip refund ──
    if (skipRefund) {
      const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const refundRecord = `Cancelled on ${dateStr} — Reason: ${reason || "not specified"} — No refund issued`;
      if (sheetRow) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `Orders!Q${sheetRow}`,
          valueInputOption: 'RAW',
          requestBody: { values: [[refundRecord]] }
        });
      }
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, refundRecord })
      };
    }

    // ── Stripe refund ──
    if (paymentIntentId && paymentMethod === "card") {
      const refundParams = { payment_intent: paymentIntentId };
      if (amount && amount > 0) {
        refundParams.amount = Math.round(amount * 100);
      }
      const refund = await stripe.refunds.create(refundParams);
      refundId = refund.id;
      refundAmount = refund.amount / 100;
    }

    // ── Build refund record ──
    const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const ref = paymentMethod === "card" ? refundId : (manualReference || "manual");
    const refundRecord = `Refunded $${parseFloat(refundAmount).toFixed(2)} on ${dateStr} — Reason: ${reason || "not specified"} — Ref: ${ref}`;

    if (sheetRow) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Orders!Q${sheetRow}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[refundRecord]] }
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success:      true,
        refundId:     refundId,
        refundAmount: refundAmount,
        refundRecord: refundRecord
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};