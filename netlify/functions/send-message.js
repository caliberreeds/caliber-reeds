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

    const { orderNumber, name, email, message } = data;

    if (!email || !message) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
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
      subject: `Communication from Caliber Reeds Regarding Order #${orderNumber}`,
      text:
        `Hi ${firstName},\n\n` +
        `${message}\n\n` +
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