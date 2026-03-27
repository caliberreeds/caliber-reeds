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

    const { orderNumber, name, email, total, refundNote } = data;

    if (!email) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No email address provided' }) };
    }

    const firstName = name ? name.split(" ")[0] : "there";

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
      subject: `Your Order #${orderNumber} Has Been Cancelled — Caliber Reeds`,
      text:
        `Hi ${firstName},\n\n` +
        `Your Caliber Reeds order #${orderNumber} has been cancelled.\n\n` +
        (refundNote && !refundNote.includes("failed")
          ? `── REFUND ──\n${refundNote}\n` +
            `Please allow 5–10 business days for the refund to appear.\n\n`
          : "") +
        `If you have any questions or would like to place a new order, ` +
        `please don't hesitate to reach out by replying to this email.\n\n` +
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
