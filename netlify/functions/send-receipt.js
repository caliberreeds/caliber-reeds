const nodemailer = require('nodemailer');

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

    const paymentLine = paymentIntentId
      ? `Payment of $${total} received via credit/debit card.\nReference: ${paymentIntentId}`
      : reference
      ? `Payment of $${total} received.\nTransaction Reference: ${reference}`
      : `Payment of $${total} received.`;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    await transporter.sendMail({
      from:    `"Caliber Reeds by Ben" <${process.env.GMAIL_USER}>`,
      to:      email,
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
        `Shipped to:\n${address}\n\n` +
        `── PAYMENT ──\n` +
        `${paymentLine}\n\n` +
        `If you have any questions, just reply to this email.\n\n` +
        `Warmly,\n` +
        `Ben\n` +
        `Caliber Reeds by Ben\n` +
        `caliberreeds@gmail.com`
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
