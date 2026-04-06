const nodemailer = require('nodemailer');
const { google } = require('googleapis');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body);

    if (data.password !== process.env.ADMIN_PASSWORD) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const {
      orderNumber, name, email, items,
      shipping, total, address, date, paymentIntentId, reference
    } = data;

    if (!email) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No email address provided' }) };
    }

    const firstName = name ? name.split(" ")[0] : "there";
    const dateStr = date
      ? new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

      const paymentLine = reference
      ? `Payment of $${total} received.\nTransaction Reference: ${reference}`
      : paymentIntentId
        ? `Payment of $${total} received via credit/debit card.\nReference: ${paymentIntentId}`
        : `Payment of $${total} received.`;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    // Only send email for Venmo/Zelle — card customers already got receipt in confirmation email
    if (!paymentIntentId || reference) {
      await transporter.sendMail({
        from: `"Caliber Reeds by Ben" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: `Your Receipt for Order #${orderNumber} — Caliber Reeds`,
        text:
          `Hi ${firstName},\n\n` +
          `Here is your receipt for your Caliber Reeds order. ` +
          `Thank you so much for your support!\n\n` +
          `── RECEIPT ──\n` +
          `Order #:   ${orderNumber}\n` +
          `Date:      ${dateStr}\n` +
          `Items:     ${items}\n` +
          `Shipping:  $${shipping}\n` +
          `Total:     $${total}\n\n` +
          `Shipping Address:\n${address}\n\n` +
          `── PAYMENT ──\n` +
          `${paymentLine}\n\n` +
          `If you have any questions, just reply to this email.\n\n` +
          `Warmly,\n` +
          `Ben\n` +
          `Caliber Reeds by Ben\n` +
          `caliberreeds@gmail.com`
      });
    }

      // Set up sheets auth once for reuse
      const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
      const sheets = google.sheets({ version: 'v4', auth });
      const spreadsheetId = process.env.SPREADSHEET_ID;

      // Find the sheet row for this order
      const ordersResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Orders!A2:A'
      });
      const rows = ordersResponse.data.values || [];
      const rowIndex = rows.findIndex(row => row[0] && row[0].toString() === orderNumber.toString());
      const sheetRow = rowIndex !== -1 ? rowIndex + 2 : null;

      // Save reference to column N if provided
      if (reference && sheetRow) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `Orders!N${sheetRow}`,
          valueInputOption: 'RAW',
          requestBody: { values: [[reference]] }
        });
      }

      // Generate receipt PDF via Apps Script
      const SCRIPT_URL = process.env.APPS_SCRIPT_URL;
      let receiptUrl = "";
      try {
        const scriptRes = await fetch(SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "createReceipt",
            orderNumber: orderNumber,
            date: date,
            name: name,
            email: email,
            address: address,
            items: items,
            shipping: shipping,
            total: total,
            paymentRef: reference || paymentIntentId || ""
          })
        });
        const scriptText = await scriptRes.text();
        console.log("Apps Script response:", scriptText);
        const scriptData = JSON.parse(scriptText);
        receiptUrl = scriptData.docUrl || "";
      } catch (err) {
        console.warn("Could not generate receipt PDF:", err);
      }

      // Save receipt URL to column P if generated
      if (receiptUrl && sheetRow) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `Orders!P${sheetRow}`,
          valueInputOption: 'RAW',
          requestBody: { values: [[receiptUrl]] }
        });
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, receiptUrl })
      };

    } catch (err) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: err.message })
      };
    }
  };
