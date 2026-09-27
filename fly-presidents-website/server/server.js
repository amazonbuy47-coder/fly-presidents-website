require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const Stripe = require('stripe');
const { Resend } = require('resend');
const { PRODUCTS, findProduct } = require('./products');

const app = express();
const PORT = process.env.PORT || 4242;
const SITE_URL = process.env.SITE_URL || `http://localhost:${PORT}`;
const ORDERS_FILE = path.join(__dirname, 'orders.json');

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

if (!stripe) {
  console.warn('[warn] STRIPE_SECRET_KEY is not set — checkout will not work until you add it to .env');
}
if (!resend) {
  console.warn('[warn] RESEND_API_KEY is not set — order emails will not be sent until you add it to .env');
}

// --- Static frontend ---
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- Product list, used by the frontend to render cards + prices ---
app.get('/api/products', (req, res) => {
  res.json(PRODUCTS.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    priceCents: p.priceCents,
    currency: p.currency,
    image: p.image
  })));
});

// --- Create a Stripe Checkout Session for one product ---
// This is what puts up the actual, secure, Stripe-hosted payment page —
// the equivalent of "checkout" on any other retailer's site.
app.post('/create-checkout-session', express.json(), async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe is not configured yet. Add STRIPE_SECRET_KEY to .env.' });
  }
  const { productId } = req.body;
  const product = findProduct(productId);
  if (!product) {
    return res.status(400).json({ error: 'Unknown product.' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: product.currency,
            product_data: { name: product.name, description: product.description },
            unit_amount: product.priceCents
          },
          quantity: 1
        }
      ],
      shipping_address_collection: { allowed_countries: ['US'] },
      success_url: `${SITE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/cancel.html`,
      metadata: { productId: product.id }
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe session creation failed:', err.message);
    res.status(500).json({ error: 'Could not start checkout. Check the server logs.' });
  }
});

// --- Stripe webhook: fires when a payment actually completes ---
// This is the source of truth for "a sale happened" — never trust the
// success redirect alone, since a customer can close the tab before it loads.
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) return res.status(500).send('Stripe not configured');

  let event;
  try {
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    await handleCompletedOrder(session);
  }

  res.json({ received: true });
});

async function handleCompletedOrder(session) {
  const product = findProduct(session.metadata && session.metadata.productId);
  const order = {
    id: session.id,
    createdAt: new Date().toISOString(),
    product: product ? product.name : 'Unknown product',
    amountTotal: session.amount_total,
    currency: session.currency,
    customerEmail: session.customer_details ? session.customer_details.email : null,
    customerName: session.customer_details ? session.customer_details.name : null,
    shipping: session.shipping_details || null
  };

  // 1. Log it — this is the site's own transaction record.
  logOrder(order);

  // 2. Email the customer a confirmation, and email the store owner an alert.
  await sendOrderEmails(order);
}

function logOrder(order) {
  let orders = [];
  if (fs.existsSync(ORDERS_FILE)) {
    try {
      orders = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
    } catch {
      orders = [];
    }
  }
  orders.unshift(order);
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

async function sendOrderEmails(order) {
  if (!resend) {
    console.warn('[warn] Skipping order emails — RESEND_API_KEY not set.');
    return;
  }
  const from = process.env.STORE_FROM_EMAIL || 'orders@example.com';
  const ownerEmail = process.env.STORE_OWNER_EMAIL;
  const amount = (order.amountTotal / 100).toFixed(2);

  // Alert to the store owner — this is the "important notification"
  // beyond what the Stripe app's push notification already gives you.
  if (ownerEmail) {
    try {
      await resend.emails.send({
        from,
        to: ownerEmail,
        subject: `New order: ${order.product} — $${amount}`,
        text: `New order placed.\n\nProduct: ${order.product}\nAmount: $${amount} ${order.currency}\nCustomer: ${order.customerName || 'n/a'} (${order.customerEmail || 'n/a'})\nOrder ID: ${order.id}\nTime: ${order.createdAt}`
      });
    } catch (err) {
      console.error('Failed to send owner notification email:', err.message);
    }
  }

  // Receipt to the customer.
  if (order.customerEmail) {
    try {
      await resend.emails.send({
        from,
        to: order.customerEmail,
        subject: `Your Fly Presidents order is confirmed`,
        text: `Thanks for copping ${order.product}!\n\nAmount charged: $${amount} ${order.currency}\nOrder ID: ${order.id}\n\nWe'll be in touch with shipping details.\n\n— Fly Presidents`
      });
    } catch (err) {
      console.error('Failed to send customer receipt email:', err.message);
    }
  }
}

// --- Simple order log viewer, for your own use only ---
// Protected by a shared secret in the URL so it isn't public. Don't share
// this link. For anything more serious, use the Stripe Dashboard/app instead
// — it already shows every transaction and pushes notifications to your phone.
app.get('/admin/orders', (req, res) => {
  if (!process.env.ADMIN_KEY || req.query.key !== process.env.ADMIN_KEY) {
    return res.status(403).send('Forbidden — add ?key=YOUR_ADMIN_KEY (set ADMIN_KEY in .env)');
  }
  let orders = [];
  if (fs.existsSync(ORDERS_FILE)) {
    orders = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  }
  res.json(orders);
});

app.listen(PORT, () => {
  console.log(`Fly Presidents server running at ${SITE_URL}`);
});
