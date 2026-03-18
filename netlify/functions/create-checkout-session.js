const Stripe = require('stripe');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const data = JSON.parse(event.body);

    // Build line items from cart
    const lineItems = [];
    const prices = {
      "Student Oboe":  2300,
      "Advanced Oboe": 2700,
      "Student EH":    3100,
      "Advanced EH":   3500
    };

    const counts = {};
    (data.cart || []).forEach(item => {
      counts[item] = (counts[item] || 0) + 1;
    });

    for (let item in counts) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: item },
          unit_amount: prices[item]
        },
        quantity: counts[item]
      });
    }

    // Add shipping as a line item
    const shippingLabel = data.shipping === "9"
      ? "USPS Priority Mail"
      : "USPS Ground Advantage";

    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: { name: shippingLabel },
        unit_amount: parseInt(data.shipping) * 100
      },
      quantity: 1
    });

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      customer_email: data.email || undefined,
      metadata: {
        name:     data.name    || "",
        email:    data.email   || "",
        address:  data.address || "",
        notes:    data.notes   || "",
        items:    JSON.stringify(counts),
        shipping: data.shipping || "5",
        total:    data.total   || "0"
      },
      success_url: data.successUrl + '?session_id={CHECKOUT_SESSION_ID}',
      cancel_url:  data.cancelUrl
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ id: session.id, url: session.url })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
