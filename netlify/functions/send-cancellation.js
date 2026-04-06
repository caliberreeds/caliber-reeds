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

    const { orderNumber, name, email, total, items, refundAmount, refundType, reason, refundRef, paymentMethod } = data;

    if (!email) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No email address provided' }) };
    }

    const firstName = name ? name.split(" ")[0] : "there";
    const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    let refundSection = "";
    if (refundType === "full") {
      refundSection =
        `── REFUND ──\n` +
        `A full refund of $${parseFloat(total).toFixed(2)} has been issued.\n` +
        (paymentMethod === "card"
          ? `Reference: ${refundRef}\nPlease allow 5–10 business days for the refund to appear.\n`
          : `This refund was issued manually via ${paymentMethod}.\nReference: ${refundRef}\n`) +
        `\n`;
    } else if (refundType === "partial") {
      refundSection =
        `── REFUND ──\n` +
        `A partial refund of $${parseFloat(refundAmount).toFixed(2)} has been issued.\n` +
        (paymentMethod === "card"
          ? `Reference: ${refundRef}\nPlease allow 5–10 business days for the refund to appear.\n`
          : `This refund was issued manually via ${paymentMethod}.\nReference: ${refundRef}\n`) +
        `\n`;
    }

    await transporter.sendMail({
      from:    `"Caliber Reeds by Ben" <${process.env.GMAIL_USER}>`,
      to:      email,
      subject: refundType === "partial" 
        ? `Partial Refund Issued for Order #${orderNumber} — Caliber Reeds`
        : `Your Order #${orderNumber} Has Been Cancelled — Caliber Reeds`,
      text:
        `Hi ${firstName},\n\n` +
        (refundType === "partial"
          ? `A partial refund has been issued for your Caliber Reeds order #${orderNumber}.\n\n`
          : `Your Caliber Reeds order #${orderNumber} has been cancelled.\n\n`) +
        `── ORDER SUMMARY ──\n` +
        `Order #:  ${orderNumber}\n` +
        `Date:     ${dateStr}\n` +
        `Items:    ${items}\n` +
        `Total:    $${parseFloat(total).toFixed(2)}\n` +
        (reason ? `Reason:   ${reason}\n` : "") +
        `\n` +
        refundSection +
        `If you have any questions, please don't hesitate to reach out by replying to this email.\n\n` +
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