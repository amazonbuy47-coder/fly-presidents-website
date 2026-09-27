# Fly Presidents — Website

A real, working storefront: browse products, check out through a secure
Stripe-hosted payment page, and get notified (email + your Stripe phone app)
the moment a sale comes in. Every order is also logged to your own
`server/orders.json` file as a simple transaction record.

## What's here

```
fly-presidents-website/
├── public/              the storefront (what customers see)
│   ├── index.html
│   ├── success.html     shown after a successful payment
│   ├── cancel.html      shown if checkout is abandoned
│   ├── styles.css
│   ├── main.js           loads products + starts checkout
│   └── images/
├── server/
│   ├── server.js         Express app: product API, checkout, webhook, emails
│   ├── products.js        ⚠️ placeholder $65 prices — edit before going live
│   └── orders.json        created automatically once your first sale comes in
├── .env.example           copy to .env and fill in your own keys
└── package.json
```

## What you need to set up yourself

I can't create accounts or handle real payment/API credentials for you —
that part only you can do, and it only takes about 10 minutes.

### 1. Stripe (takes the payments)

1. Go to https://dashboard.stripe.com/register and create an account (free).
2. In the dashboard, go to **Developers → API keys**. Copy the **Secret key**
   (starts with `sk_test_...` while you're testing).
3. Install the **Stripe mobile app** (iOS/Android) and sign in — this is
   what pushes "💰 You got a payment" notifications straight to your phone,
   in real time, with zero extra setup on my end.

### 2. Resend (sends order emails)

1. Go to https://resend.com and create a free account.
2. Go to **API Keys** and create one. Copy it.
3. For the `STORE_FROM_EMAIL` below to work with your own domain
   (e.g. `orders@flypresidents.com`), you'd verify that domain in Resend.
   Until then, Resend's own shared sending address will still work fine
   for testing.

### 3. Fill in your `.env` file

Copy the example file and fill in what you just collected:

```bash
cp .env.example .env
```

Then open `.env` and fill in:
- `STRIPE_SECRET_KEY` — from Stripe (use the `sk_test_...` one first)
- `RESEND_API_KEY` — from Resend
- `STORE_OWNER_EMAIL` — the email address **you** want order alerts sent to
- `STORE_FROM_EMAIL` — the "from" address on outgoing emails
- `ADMIN_KEY` — make up any private password-like string; it protects your
  `/admin/orders` page

Leave `STRIPE_WEBHOOK_SECRET` blank for now — you'll get that in step 5.

**Never commit or share your real `.env` file — it holds secret keys.**

### 4. Install and run it

```bash
npm install
npm start
```

Visit http://localhost:4242 — your storefront is live locally. Product
cards, checkout, everything works end to end (Stripe will show its test
payment page — no real card is needed if you're using a `sk_test_` key;
use card number `4242 4242 4242 4242`, any future expiry, any CVC).

### 5. Connect the webhook (this is what actually records + emails each sale)

While developing locally, install the [Stripe CLI](https://docs.stripe.com/stripe-cli)
and run:

```bash
stripe listen --forward-to localhost:4242/webhook
```

It will print a `whsec_...` value — put that in `.env` as
`STRIPE_WEBHOOK_SECRET`, then restart `npm start`.

When you deploy the site for real (see below), set up the webhook in the
Stripe Dashboard instead: **Developers → Webhooks → Add endpoint**, point it
at `https://yourdomain.com/webhook`, select the `checkout.session.completed`
event, and copy the signing secret it gives you into your production `.env`.

## Before you take real orders

- **Update pricing.** Open `server/products.js` — every price is currently
  a **$65.00 placeholder**. Set the real prices (and add/remove products)
  before switching to live Stripe keys.
- **Switch Stripe to live mode.** Swap `sk_test_...` for your real
  `sk_live_...` secret key once you're ready to accept real payments, and
  set up the live-mode webhook too (test and live webhooks are separate).
- **Fill in the placeholder copy** in `public/index.html` — search for
  text in `[BRACKETS]` (brand story, shipping details, footer blurb) and
  replace with your own words.
- **Add real product photos.** The three products currently reuse the
  gallery/logo images as placeholders — swap in real product shots in
  `public/images/`.

## Where to deploy it

This is a normal Node/Express app, so it runs on any standard host:
[Render](https://render.com), [Railway](https://railway.app),
[Fly.io](https://fly.io), or a VPS all work well and have free/cheap tiers.
Deployment steps:

1. Push this folder to a GitHub repo (or upload it directly if the host
   supports that).
2. Set the same environment variables from your `.env` file in the host's
   dashboard (never upload the `.env` file itself).
3. Set `SITE_URL` to your real domain (e.g. `https://flypresidents.com`) —
   this is what Stripe uses to send customers back after payment.
4. Point your domain's DNS at the host, following their instructions.
5. Add the production webhook in Stripe pointing at
   `https://yourdomain.com/webhook` (see step 5 above).

## Checking your sales

- **Fastest / best:** the Stripe Dashboard (dashboard.stripe.com) or Stripe
  mobile app — shows every transaction, refund, and customer, and is where
  your phone push notifications come from.
- **Your own copy:** visit `https://yourdomain.com/admin/orders?key=YOUR_ADMIN_KEY`
  (the `ADMIN_KEY` you set in `.env`) to see the raw order log this site
  keeps in `server/orders.json`. Keep that link private — don't share it.

## How notifications work

Every completed payment triggers, automatically:
1. A row appended to `server/orders.json` (your own transaction record).
2. An email to you (`STORE_OWNER_EMAIL`) with the order details.
3. A receipt email to the customer.
4. A push notification to your phone via the Stripe app (once you've
   installed it and signed in — no extra setup needed from this codebase).

## Security notes

- Card numbers never touch this server — Stripe Checkout is a page hosted
  by Stripe itself, which is what keeps you out of PCI-compliance scope.
- `.env` is git-ignored so your real keys never get committed.
- The `/admin/orders` route requires the secret `ADMIN_KEY` you set — don't
  reuse it anywhere else, and don't share the link.
