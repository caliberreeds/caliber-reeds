const Stripe = require('stripe');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const { sessionId } = JSON.parse(event.body);

    if (!sessionId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing sessionId' }) };
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return {
      statusCode: 200,
      body: JSON.stringify({
        paymentIntentId: session.payment_intent,
        amountTotal:     session.amount_total
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
