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

    const { orderNumber, name, email, items } = data;

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
      from: `"Caliber Reeds by Ben" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `How Are Your Reeds? — Caliber Reeds`,
      text:
        `Hi ${firstName},\n\n` +
        `I hope you've had a chance to play on your reeds from order #${orderNumber} ` +
        `(${items}) and that they're feeling great!\n\n` +
        `I'd love to hear how they're working out for you. If you have a moment, ` +
        `would you mind sending me a sentence or two about your experience? ` +
        `Your words mean a lot and help other musicians find the right reed.\n\n` +
        `Just reply directly to this email — it only takes a minute!\n\n` +
        `Thank you so much for your support. It truly means the world.\n\n` +
        `Warmly,\n` +
        `Ben\n` +
        `Caliber Reeds by Ben\n` +
        `caliberreeds@gmail.com`
    });

    return { statusCode: 200, body: JSON.stringify({ success: true }) };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};