// Renders the product catalog from /api/products and wires each
// "Buy Now" button to Stripe Checkout via /create-checkout-session.

async function loadProducts() {
  const container = document.getElementById('products');
  if (!container) return;

  let products = [];
  try {
    const res = await fetch('/api/products');
    products = await res.json();
  } catch (err) {
    container.innerHTML = '<p style="color: var(--fg-muted);">Could not load products right now. Refresh the page to try again.</p>';
    return;
  }

  if (!products.length) {
    container.innerHTML = '<p style="color: var(--fg-muted);">No products available yet.</p>';
    return;
  }

  container.innerHTML = products.map((p) => `
    <div class="product-card">
      <img src="${p.image}" alt="${p.name}">
      <div class="product-row">
        <span class="name">${p.name}</span>
        <span class="price">$${(p.priceCents / 100).toFixed(2)}</span>
      </div>
      <button class="btn btn-primary" data-product-id="${p.id}">Buy Now</button>
    </div>
  `).join('');

  container.querySelectorAll('button[data-product-id]').forEach((btn) => {
    btn.addEventListener('click', () => startCheckout(btn));
  });
}

async function startCheckout(btn) {
  const productId = btn.getAttribute('data-product-id');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Starting checkout…';

  try {
    const res = await fetch('/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId })
    });
    const data = await res.json();

    if (!res.ok || !data.url) {
      throw new Error(data.error || 'Checkout could not be started.');
    }

    window.location.href = data.url;
  } catch (err) {
    btn.disabled = false;
    btn.textContent = originalText;
    alert(err.message || 'Something went wrong starting checkout. Please try again.');
  }
}

document.addEventListener('DOMContentLoaded', loadProducts);
