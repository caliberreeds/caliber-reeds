const Stripe = require('stripe');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const data = JSON.parse(event.body);

    console.log("Received data:", JSON.stringify(data));
    console.log("Stripe key exists:", !!process.env.STRIPE_SECRET_KEY);

    // Build line items from cart
    const lineItems = [];
    const prices = {
      "Student Oboe Reed":           23,
      "Advance Oboe Reed":           27,
      "Student English Horn Reed":   31,
      "Advanced English Horn Reed":  35
    };

    const counts = {};
    (data.cart || []).forEach(item => {
      counts[item] = (counts[item] || 0) + 1;
    });

    console.log("Counts:", JSON.stringify(counts));
    console.log("Price lookup:", JSON.stringify(Object.keys(counts).map(k => ({item: k, price: prices[k]}))));

    for (let item in counts) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: item },
          unit_amount: Math.round(prices[item] * 100)
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
        unit_amount: Math.round(parseFloat(data.shipping) * 100)
      },
      quantity: 1
    });

    console.log("Line items:", JSON.stringify(lineItems));

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
        shipping: data.shipping || "5",
        total:    data.total   || "0"
      },
      success_url: data.successUrl + '?session_id={CHECKOUT_SESSION_ID}',
      cancel_url:  data.cancelUrl
    });

    console.log("Session created:", session.id);

    return {
      statusCode: 200,
      body: JSON.stringify({ id: session.id, url: session.url })
    };

  } catch (err) {
    console.log("ERROR:", err.message);
    console.log("ERROR STACK:", err.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
