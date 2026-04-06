const nodemailer = require('nodemailer');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { name, email, subject, orderNumber, message } = JSON.parse(event.body);

    if (!name || !email || !message) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    // Email to Ben
    await transporter.sendMail({
      from: `"Caliber Reeds Contact Form" <${process.env.GMAIL_USER}>`,
      to:   process.env.GMAIL_USER,
      replyTo: email,
      subject: `📬 New Message from ${name}${subject ? ' — ' + subject : ''}`,
      text:
        `New message from the Caliber Reeds contact form.\n\n` +
        `Name:         ${name}\n` +
        `Email:        ${email}\n` +
        (subject     ? `Subject:      ${subject}\n`     : "") +
        (orderNumber ? `Order Number: #${orderNumber}\n` : "") +
        `\n── MESSAGE ──\n${message}\n\n` +
        `Reply directly to this email to respond to ${name}.`
    });

    // Confirmation email to customer
    await transporter.sendMail({
      from:    `"Caliber Reeds by Ben" <${process.env.GMAIL_USER}>`,
      to:      email,
      subject: `Thanks for reaching out — Caliber Reeds`,
      text:
        `Hi ${name.split(" ")[0]},\n\n` +
        `Thanks for getting in touch! I've received your message and will get back to you as soon as I can — usually within a day or two.\n\n` +
        `If your question is urgent, feel free to reply directly to this email.\n\n` +
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