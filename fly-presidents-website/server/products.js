// Product catalog for Stripe Checkout.
//
// IMPORTANT: the prices below are PLACEHOLDERS ($65.00) — nobody told me
// real pricing for the Presidential Gallery drop, so update `priceCents`
// for each product before taking real orders. Amounts are in cents
// (Stripe requires the smallest currency unit, so $65.00 = 6500).

const PRODUCTS = [
  {
    id: 'presidential-gallery-black',
    name: 'Presidential Shop — Black',
    description: 'Fly Presidents windbreaker set, black colorway.',
    priceCents: 6500,
    currency: 'usd',
    image: 'images/bandsomechris.jpg'
  },
  {
    id: 'presidential-gallery-lavender',
    name: 'Presidential Shop — Lavender',
    description: 'Fly Presidents windbreaker set, lavender colorway.',
    priceCents: 6500,
    currency: 'usd',
    image: 'images/bandsomerj.jpg'
  },
  {
    id: 'presidential-gallery-white-green',
    name: 'Presidential Shop — White/Green',
    description: 'Fly Presidents windbreaker set, white/green colorway.',
    priceCents: 6500,
    currency: 'usd',
    image: 'images/logo.png'
  }
];

function findProduct(id) {
  return PRODUCTS.find((p) => p.id === id);
}

module.exports = { PRODUCTS, findProduct };
