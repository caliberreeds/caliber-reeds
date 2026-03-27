const Stripe = require('stripe');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const { paymentIntentId, amount } = JSON.parse(event.body);

    if (!paymentIntentId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing paymentIntentId' })
      };
    }

    // Build refund params — if amount provided, do partial; otherwise full
    const refundParams = { payment_intent: paymentIntentId };
    if (amount && amount > 0) {
      refundParams.amount = Math.round(amount * 100); // convert dollars to cents
    }

    const refund = await stripe.refunds.create(refundParams);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success:  true,
        refundId: refund.id,
        status:   refund.status,
        amount:   refund.amount / 100  // convert back to dollars for confirmation
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
