/* ══════════════════════════════════════════════════════════
   Vision Giants – shared.js
   Unified logic for header, footer, theming, local/remote
   product data, cart management, modals, and helper utilities.
═════════════════════════════════════════════════════════════ */

// ---------- CONFIGURATION & CONSTANTS ----------
const CART_STORAGE_KEY = 'visiongiants_cart';
const THEME_STORAGE_KEY = 'visiongiants_theme';
let PRODUCTS_CACHE = null;

// ---------- IMMEDIATE THEME INITIALIZATION ----------
// Executes immediately to prevent Flash of Unstyled Content (FOUC)
(function preInitTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
})();

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initBackToTop();
  reconcileCart().then(refreshCartCount);
  initDynamicNavAndFooter();
  initSearchBar();
});

/* ---------- THEME MANAGEMENT ---------- */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const themeIcon = document.getElementById('themeIcon');
  if (themeIcon) {
    themeIcon.innerHTML = theme === 'light'
      ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
      : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  }
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

function initTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(currentTheme);

  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }
}

/* ---------- UX HELPERS (BACK TO TOP / TOAST) ---------- */
function initBackToTop() {
  const btt = document.getElementById('btt');
  if (!btt) return;
  window.addEventListener('scroll', () => {
    btt.classList.toggle('show', window.scrollY > 400);
  });
  btt.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

function showCartToast(message = '🛒 Item added to cart!') {
  let toast = document.getElementById('cartToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'cartToast';
    toast.style.cssText = `
      position:fixed;bottom:80px;right:28px;z-index:9999;
      background:#06B6D4;color:#fff;
      padding:12px 20px;border-radius:12px;
      font-size:0.85rem;font-weight:600;
      box-shadow:0 4px 20px rgba(6,182,212,0.5);
      transform:translateY(20px);opacity:0;
      transition:all 0.3s ease;
      display:flex;align-items:center;gap:8px;
    `;
    document.body.appendChild(toast);
  }
  toast.innerHTML = message;
  setTimeout(() => { toast.style.transform = 'translateY(0)'; toast.style.opacity = '1'; }, 10);
  setTimeout(() => {
    toast.style.transform = 'translateY(20px)';
    toast.style.opacity = '0';
  }, 2000);
}

/* ---------- SIGN-IN MODAL ---------- */
function openModal() {
  const modal = document.getElementById('modal');
  if (modal) modal.classList.add('open');
}

function closeModal(event, forceClose) {
  const modal = document.getElementById('modal');
  if (!modal) return;
  if (forceClose || !event || event.target === modal) {
    modal.classList.remove('open');
  }
}

/* ---------- NAVIGATION & FORMATTING HELPERS ---------- */
function goToCategory(categoryId) {
  window.location.href = `products.html?category=${encodeURIComponent(categoryId)}`;
}

function goToProduct(productId) {
  window.location.href = `product.html?id=${encodeURIComponent(productId)}`;
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function formatPrice(value) {
  return 'Rs ' + Math.round(Number(value)).toLocaleString('en-PK');
}

function getDiscountPercent(original, price) {
  if (!original || original <= price) return 0;
  return Math.round(((original - price) / original) * 100);
}

/* ---------- SEARCH (live in-page dropdown) ---------- */
/**
 * Injects the CSS needed for the search results dropdown. Done once,
 * from JS, so every page that includes shared.js gets the dropdown
 * styled correctly without needing to touch each page's <style> block.
 * Uses the same CSS variables (--bg2, --border, --cyan, etc.) already
 * defined on :root by each page.
 */
function injectSearchStyles() {
  if (document.getElementById('searchDropdownStyles')) return;
  const style = document.createElement('style');
  style.id = 'searchDropdownStyles';
  style.textContent = `
    .search-results {
      position: absolute; top: calc(100% + 8px); left: 0; right: 0;
      background: var(--bg2); border: 1px solid var(--border);
      border-radius: 14px; padding: 8px;
      max-height: 360px; overflow-y: auto;
      box-shadow: 0 20px 50px rgba(0,0,0,0.35);
      opacity: 0; pointer-events: none; transform: translateY(-6px);
      transition: opacity 0.18s, transform 0.18s;
      z-index: 1500;
    }
    .search-results.open { opacity: 1; pointer-events: auto; transform: translateY(0); }
    .search-result-item {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 12px; border-radius: 10px; cursor: pointer;
      transition: background 0.15s;
    }
    .search-result-item:hover { background: var(--cyan-glow); }
    .search-result-icon {
      width: 38px; height: 38px; border-radius: 9px; flex-shrink: 0;
      background: var(--bg3, var(--bg)); display: flex; align-items: center;
      justify-content: center; font-size: 1.2rem;
    }
    .search-result-info { flex: 1; min-width: 0; }
    .search-result-name {
      font-size: 0.85rem; font-weight: 600; color: var(--text);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .search-result-meta { font-size: 0.74rem; color: var(--gray-mid); margin-top: 1px; }
    .search-result-price {
      font-family: 'Orbitron', monospace; font-size: 0.82rem;
      font-weight: 700; color: var(--cyan); white-space: nowrap; flex-shrink: 0;
    }
    .search-empty {
      padding: 18px 12px; text-align: center; font-size: 0.82rem; color: var(--gray-mid);
    }
  `;
  document.head.appendChild(style);
}

/**
 * Wires up every `.search-bar input` on the page so that typing shows a
 * live dropdown of matching products right underneath it, updating on
 * every keystroke. Selecting a result takes the user to that product's
 * page; nothing here ever redirects just for typing/searching itself.
 */
function initSearchBar() {
  const bars = document.querySelectorAll('.search-bar');
  if (!bars.length) return;
  injectSearchStyles();

  bars.forEach(bar => {
    const input = bar.querySelector('input');
    if (!input) return;

    // The dropdown needs to be positioned relative to the search bar
    bar.style.position = bar.style.position || 'relative';

    const results = document.createElement('div');
    results.className = 'search-results';
    bar.appendChild(results);

    let activeIndex = -1;
    let currentMatches = [];

    const closeResults = () => {
      results.classList.remove('open');
      activeIndex = -1;
    };

    const renderResults = (matches, query) => {
      currentMatches = matches;
      activeIndex = -1;

      if (!query) {
        closeResults();
        return;
      }

      if (!matches.length) {
        results.innerHTML = `<div class="search-empty">No products match "${query}"</div>`;
        results.classList.add('open');
        return;
      }

      results.innerHTML = matches.slice(0, 8).map((p, i) => `
        <div class="search-result-item" data-index="${i}" data-id="${p.id}">
          <div class="search-result-icon">${p.emoji || p.image || '📦'}</div>
          <div class="search-result-info">
            <div class="search-result-name">${p.name}</div>
            <div class="search-result-meta">${p.category || ''}</div>
          </div>
          <div class="search-result-price">${formatPrice(p.price)}</div>
        </div>
      `).join('');
      results.classList.add('open');

      results.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
          goToProduct(item.dataset.id);
        });
      });
    };

    const runFilter = async () => {
      const query = input.value.trim();
      if (!query) {
        closeResults();
        return;
      }
      const { products } = await loadProducts();
      const matches = filterProducts(products, query);
      renderResults(matches, query);
    };

    // Live filtering: fires on every keystroke
    input.addEventListener('input', runFilter);

    input.addEventListener('focus', () => {
      if (input.value.trim()) runFilter();
    });

    // Keyboard navigation through the dropdown
    input.addEventListener('keydown', (e) => {
      const items = results.querySelectorAll('.search-result-item');
      if (!items.length || !results.classList.contains('open')) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, items.length - 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const target = activeIndex >= 0 ? items[activeIndex] : items[0];
        if (target) goToProduct(target.dataset.id);
        return;
      } else if (e.key === 'Escape') {
        closeResults();
        return;
      } else {
        return;
      }

      items.forEach((item, i) => item.style.background = i === activeIndex ? 'var(--cyan-glow)' : '');
    });

    // Close the dropdown when clicking anywhere outside the search bar
    document.addEventListener('click', (e) => {
      if (!bar.contains(e.target)) closeResults();
    });
  });
}

/**
 * Case-insensitive filter across name, category, and description.
 */
function filterProducts(products, query) {
  if (!query) return products;
  const q = query.trim().toLowerCase();
  if (!q) return products;
  return products.filter(p =>
    (p.name || '').toLowerCase().includes(q) ||
    (p.category || '').toLowerCase().includes(q) ||
    (p.description || '').toLowerCase().includes(q)
  );
}

/* ---------- CART CORE ENGINE (localStorage) ---------- */
function getCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveCart(cart) {
  // Gracefully filter out zero or negative quantities before committing to disk
  const validCart = cart.filter(item => item.qty > 0);
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(validCart));
  } catch (e) { /* Fallback for isolated private browsing environments */ }
  refreshCartCount();
}

function clearCart() {
  localStorage.removeItem(CART_STORAGE_KEY);
  refreshCartCount();
}

function addToCart(productId, qty = 1, event = null) {
  if (event) event.stopPropagation();
  const cart = getCart();
  const existing = cart.find(item => item.id === productId);

  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({ id: productId, qty: qty });
  }

  saveCart(cart);
  showCartToast();
  return cart;
}

function setCartQty(productId, qty) {
  let cart = getCart();
  if (qty <= 0) {
    cart = cart.filter(item => item.id !== productId);
  } else {
    const existing = cart.find(item => item.id === productId);
    if (existing) existing.qty = qty;
    else cart.push({ id: productId, qty });
  }
  saveCart(cart);
  return cart;
}

function increaseCartQty(productId, by = 1) {
  const cart = getCart();
  const existing = cart.find(item => item.id === productId);
  if (existing) existing.qty += by;
  saveCart(cart);
  return cart;
}

function decreaseCartQty(productId, by = 1) {
  const cart = getCart();
  const existing = cart.find(item => item.id === productId);
  if (existing) {
    existing.qty -= by;
    if (existing.qty <= 0) {
      return removeFromCart(productId);
    }
  }
  saveCart(cart);
  return cart;
}

function removeFromCart(productId) {
  const cart = getCart().filter(item => item.id !== productId);
  saveCart(cart);
  return cart;
}

function getCartCount() {
  return getCart().reduce((sum, item) => sum + item.qty, 0);
}

function refreshCartCount() {
  const count = getCartCount();
  document.querySelectorAll('.cartCount').forEach(el => {
    el.textContent = count;
    el.style.display = count > 0 ? 'flex' : 'none';
  });
}

function buyNow(productId, event = null) {
  if (event) event.stopPropagation();
  addToCart(productId, 1);
  window.location.href = 'cart.html';
}

/* ---------- PRODUCT RESOURCE LAYER ---------- */
const CATEGORIES = [
  { id: 'smartphones', name: 'Smartphones', emoji: '📱', count: 1200 },
  { id: 'laptops', name: 'Laptops', emoji: '💻', count: 860 },
  { id: 'audio', name: 'Audio', emoji: '🎧', count: 950 },
  { id: 'cameras', name: 'Cameras', emoji: '📷', count: 410 },
  { id: 'gaming', name: 'Gaming', emoji: '🎮', count: 730 },
  { id: 'wearables', name: 'Wearables', emoji: '⌚', count: 540 },
  { id: 'tablets', name: 'Tablets', emoji: '📲', count: 320 },
  { id: 'accessories', name: 'Accessories', emoji: '🖱️', count: 1500 },
  { id: 'smarthome', name: 'Smart Home', emoji: '🏠', count: 690 },
];

const PRODUCTS = [
  {
    id: 'p1', categoryId: 'smartphones', category: 'Smartphones', emoji: '📱',
    name: 'Nova X12 Pro 5G', price: 305000, originalPrice: 361000, rating: 4.7, reviews: 2381,
    badge: 'NEW',
    description: 'A flagship smartphone with a stunning 6.7" AMOLED display, triple-lens camera system, and all-day battery life built for power users.',
    specs: { Display: '6.7" AMOLED 120Hz', Storage: '256GB', RAM: '12GB', Battery: '5000mAh', Camera: '108MP Triple' },
    features: ['5G Connectivity', 'Wireless Fast Charging', 'IP68 Water Resistance', 'In-Display Fingerprint']
  },
  {
    id: 'p2', categoryId: 'laptops', category: 'Laptops', emoji: '💻',
    name: 'AeroBook 14 Ultra', price: 403000, originalPrice: 473000, rating: 4.6, reviews: 1542,
    badge: '15% OFF',
    description: 'Ultra-thin and powerful, the AeroBook 14 Ultra delivers desktop-class performance in a featherweight chassis perfect for creators on the move.',
    specs: { Processor: 'Octa-Core 3.2GHz', RAM: '16GB', Storage: '1TB SSD', Display: '14" 2.8K OLED', Weight: '1.2kg' },
    features: ['All-Day Battery', 'Thunderbolt 4', 'Backlit Keyboard', 'Aluminum Unibody']
  },
  {
    id: 'p3', categoryId: 'audio', category: 'Audio', emoji: '🎧',
    name: 'EchoWave ANC Headphones', price: 69000, originalPrice: null, rating: 4.8, reviews: 3920,
    badge: 'NEW',
    description: 'Immersive sound with industry-leading active noise cancellation, 40-hour battery life, and plush memory-foam ear cushions.',
    specs: { Type: 'Over-Ear', Battery: '40 Hours', ANC: 'Yes', Bluetooth: '5.3', Weight: '250g' },
    features: ['Active Noise Cancellation', 'Multipoint Pairing', 'Touch Controls', 'Foldable Design']
  },
  {
    id: 'p4', categoryId: 'cameras', category: 'Cameras', emoji: '📷',
    name: 'PixelShot Mirrorless Z5', price: 528000, originalPrice: 611000, rating: 4.9, reviews: 876,
    badge: '14% OFF',
    description: 'A professional-grade mirrorless camera with a full-frame sensor, blazing-fast autofocus, and 6K video recording.',
    specs: { Sensor: 'Full-Frame 33MP', Video: '6K 30fps', ISO: '100–51200', Mount: 'Z-Mount', Weight: '650g' },
    features: ['In-Body Stabilization', 'Weather-Sealed Body', 'Dual Card Slots', '4K Live Streaming']
  },
  {
    id: 'p5', categoryId: 'gaming', category: 'Gaming', emoji: '🎮',
    name: 'StrikePad Elite Controller', price: 24750, originalPrice: 33000, rating: 4.5, reviews: 5210,
    badge: '25% OFF',
    description: 'Tournament-grade wireless controller with hair-trigger locks, remappable paddles, and ultra-low input latency.',
    specs: { Connectivity: 'Wireless 2.4GHz', Battery: '20 Hours', Triggers: 'Hair-Trigger Lock', Paddles: '4 Remappable', Weight: '230g' },
    features: ['Adjustable Stick Tension', 'Vibration Feedback', 'USB-C Fast Charge', 'Cross-Platform']
  },
  {
    id: 'p6', categoryId: 'wearables', category: 'Wearables', emoji: '⌚',
    name: 'PulseFit Watch Series 7', price: 91500, originalPrice: null, rating: 4.6, reviews: 1987,
    badge: 'NEW',
    description: 'Track every heartbeat and workout with precision. Features GPS, blood-oxygen sensing, and a vivid always-on display.',
    specs: { Display: '1.9" AMOLED', Battery: '18 Hours', 'Water Resistance': '50m', Sensors: 'GPS, SpO2, HR', Compatibility: 'iOS & Android' },
    features: ['Always-On Display', 'Sleep Tracking', '100+ Sport Modes', 'Fall Detection']
  },
  {
    id: 'p7', categoryId: 'tablets', category: 'Tablets', emoji: '📲',
    name: 'SlateTab Pro 12.9', price: 278000, originalPrice: 319000, rating: 4.7, reviews: 1320,
    badge: '13% OFF',
    description: 'A creative powerhouse with a Liquid Retina display, stylus support, and enough power to replace your laptop.',
    specs: { Display: '12.9" Liquid Retina', Storage: '512GB', RAM: '8GB', Battery: '10 Hours', Chip: 'Octa-Core' },
    features: ['Stylus Support', 'Magnetic Keyboard Compatible', '5G Optional', 'Face Unlock']
  },
  {
    id: 'p8', categoryId: 'accessories', category: 'Accessories', emoji: '🖱️',
    name: 'OrbitHub 10-in-1 USB-C Dock', price: 16400, originalPrice: 22000, rating: 4.4, reviews: 2754,
    badge: '25% OFF',
    description: 'Expand any laptop with HDMI, Ethernet, SD card, and multiple USB ports through a single sleek aluminum hub.',
    specs: { Ports: '10-in-1', HDMI: '4K@60Hz', 'Power Delivery': '100W', Material: 'Aluminum', Cable: '20cm' },
    features: ['Plug & Play', 'No Driver Required', 'Compact Design', 'Universal Compatibility']
  },
  {
    id: 'p9', categoryId: 'smarthome', category: 'Smart Home', emoji: '🏠',
    name: 'HomeSense Hub & Camera Kit', price: 52500, originalPrice: null, rating: 4.5, reviews: 943,
    badge: 'NEW',
    description: 'Monitor and automate your home with a central smart hub, HD camera, and voice-assistant integration.',
    specs: { Resolution: '2K HD', 'Night Vision': 'Yes', Connectivity: 'Wi-Fi 6', Storage: 'Cloud + Local', Compatibility: 'Alexa, Google' },
    features: ['Two-Way Audio', 'Motion Alerts', 'Voice Assistant Ready', 'Encrypted Storage']
  },
  {
    id: 'p10', categoryId: 'smartphones', category: 'Smartphones', emoji: '📱',
    name: 'Nova Lite 5G', price: 125000, originalPrice: 153000, rating: 4.3, reviews: 1654,
    badge: '18% OFF',
    description: 'Affordable yet capable, the Nova Lite delivers smooth performance and a great camera without the flagship price.',
    specs: { Display: '6.5" LCD 90Hz', Storage: '128GB', RAM: '6GB', Battery: '4500mAh', Camera: '50MP Dual' },
    features: ['5G Ready', 'Fast Charging', 'Dual SIM', 'Side Fingerprint Sensor']
  },
  {
    id: 'p11', categoryId: 'laptops', category: 'Laptops', emoji: '💻',
    name: 'ForgeBook Gaming 16', price: 500000, originalPrice: null, rating: 4.7, reviews: 612,
    badge: 'NEW',
    description: 'Built for serious gaming and creative work, with a high-refresh display and discrete graphics for demanding titles.',
    specs: { Processor: 'Hexa-Core 4.0GHz', GPU: 'Discrete 8GB', RAM: '32GB', Storage: '1TB SSD', Display: '16" 165Hz QHD' },
    features: ['RGB Keyboard', 'Advanced Cooling', 'Wi-Fi 6E', 'High Refresh Display']
  },
  {
    id: 'p12', categoryId: 'audio', category: 'Audio', emoji: '🔊',
    name: 'BoomCast Portable Speaker', price: 22000, originalPrice: 27500, rating: 4.4, reviews: 4310,
    badge: '20% OFF',
    description: 'Take the party anywhere with this rugged, waterproof speaker delivering room-filling sound for up to 24 hours.',
    specs: { Output: '30W', Battery: '24 Hours', 'Water Resistance': 'IPX7', Bluetooth: '5.2', Weight: '600g' },
    features: ['Waterproof Design', 'Party Pairing', 'Built-In Mic', 'USB-C Charging']
  }
];

/** * Loads products/categories. Attempts a dynamic fetch from an external JSON file 
 * if setup, otherwise seamlessly falls back to inline array data.
 */
async function loadProducts() {
  if (PRODUCTS_CACHE) return PRODUCTS_CACHE;
  try {
    const res = await fetch('products.json');
    if (res.ok) {
      PRODUCTS_CACHE = await res.json();
      return PRODUCTS_CACHE;
    }
  } catch (e) { /* Fallback to hardcoded fallback definitions */ }

  PRODUCTS_CACHE = { categories: CATEGORIES, products: PRODUCTS };
  return PRODUCTS_CACHE;
}

async function getProductById(id) {
  const { products } = await loadProducts();
  return products.find(p => p.id === id) || null;
}

/**
 * Removes cart entries that no longer correspond to a real product
 * (e.g. stale localStorage data from a previous catalog) and persists
 * the cleaned cart. This is what keeps the header badge count, the
 * cart page, and checkout all in agreement about what's actually in
 * the cart. Call this (await it) before trusting cart count or totals.
 */
async function reconcileCart() {
  const { products } = await loadProducts();
  const rawCart = getCart();
  const validIds = new Set(products.map(p => p.id));
  const cleaned = rawCart.filter(item => validIds.has(item.id) && item.qty > 0);
  if (cleaned.length !== rawCart.length) {
    saveCart(cleaned);
  }
  return cleaned;
}

/* ---------- DYNAMIC NAV DROPDOWN + FOOTER "SHOP" LINKS ----------
 * Both the header "Products ▾" dropdown and the footer's "Shop" column
 * are populated here, straight from products.json's `categories` list.
 * This is the single source of truth: add, rename, or remove a category
 * in products.json and every page (nav, footer, homepage category grid,
 * products.html sidebar) updates automatically — no per-page HTML edits.
 *
 * Pages opt in by giving the relevant container these IDs:
 *   - Header dropdown:   <div class="dropdown" id="navProductsDropdown"></div>
 *   - Footer Shop list:  <ul id="footerShopLinks"></ul>
 * If a page doesn't have these containers, this is a silent no-op.
 */
async function initDynamicNavAndFooter() {
  const { categories } = await loadProducts();
  renderNavDropdown(categories);
  renderFooterShopLinks(categories);
}

function renderNavDropdown(categories) {
  const dropdown = document.getElementById('navProductsDropdown');
  if (!dropdown) return;
  dropdown.innerHTML = categories.map(cat => `
    <div class="drop-item" onclick="goToCategory('${cat.id}')">
      <div class="drop-icon">${cat.emoji}</div>
      <div>
        <div class="drop-label">${cat.name}</div>
        <div class="drop-sub">${cat.description || ''}</div>
      </div>
    </div>
  `).join('');
}

function renderFooterShopLinks(categories) {
  const list = document.getElementById('footerShopLinks');
  if (!list) return;
  list.innerHTML = categories.map(cat =>
    `<li><a href="products.html?category=${encodeURIComponent(cat.id)}">${cat.name}</a></li>`
  ).join('');
}

/* ---------- UI RENDER ENGINE: PRODUCT CARDS ---------- */
function buildProductCard(product) {
  const card = document.createElement('div');
  card.className = 'product-card';
  card.onclick = () => goToProduct(product.id);

  const badgeHtml = product.badge
    ? `<span class="${product.badge.includes('%') ? 'badge-sale' : 'badge-new'}">${product.badge}</span>`
    : '';

  const priceHtml = product.originalPrice
    ? `<span class="old">${formatPrice(product.originalPrice)}</span>${formatPrice(product.price)}`
    : formatPrice(product.price);

  const entireStars = Math.floor(product.rating || 0);
  const hasHalfStar = (product.rating || 0) % 1 !== 0;
  const ratingHtml = product.rating
    ? '★'.repeat(entireStars) + (hasHalfStar ? '☆' : '') + ` <span>(${product.rating} · ${(product.reviews || 0).toLocaleString()} reviews)</span>`
    : `<span>No reviews yet</span>`;

  card.innerHTML = `
    <div class="product-img">
      ${product.emoji}
      ${badgeHtml}
    </div>
    <div class="product-info">
      <div class="product-cat">${product.category}</div>
      <div class="product-name" style="cursor:pointer">${product.name}</div>
      <div class="product-rating">${ratingHtml}</div>
      <div class="product-footer">
        <div class="product-price">${priceHtml}</div>
        <button class="btn-cart" onclick="event.stopPropagation(); addToCart('${product.id}', 1)">🛒</button>
      </div>
      <div class="product-actions">
        <button class="btn-buy-now" onclick="buyNow('${product.id}', event)">Buy Now</button>
        <button class="btn-quick-view" onclick="openQuickView('${product.id}', event)">Quick View</button>
      </div>
    </div>
  `;
  return card;
}

/* ---------- UI RENDER ENGINE: QUICK VIEW MODAL ---------- */
function getQuickViewOverlay() {
  return document.getElementById('qvModal') || document.getElementById('quickViewModal');
}

async function openQuickView(productId, event) {
  if (event) event.stopPropagation();
  const product = await getProductById(productId);
  if (!product) return;

  const overlay = getQuickViewOverlay();
  const body = document.getElementById('qvBody');
  if (!overlay || !body) return;

  const badgeHtml = product.badge
    ? `<span class="${product.badge.includes('%') ? 'badge-sale' : 'badge-new'}">${product.badge}</span>`
    : '';

  const priceHtml = product.originalPrice
    ? `<span class="old">${formatPrice(product.originalPrice)}</span>${formatPrice(product.price)}`
    : formatPrice(product.price);

  const entireStars = Math.floor(product.rating || 0);
  const hasHalfStar = (product.rating || 0) % 1 !== 0;
  const ratingHtml = product.rating
    ? '★'.repeat(entireStars) + (hasHalfStar ? '☆' : '') + ` <span>(${product.rating} · ${(product.reviews || 0).toLocaleString()} reviews)</span>`
    : `<span>No reviews yet</span>`;

  body.innerHTML = `
    <div class="qv-img" style="display:flex;align-items:center;justify-content:center;font-size:5rem">
      ${product.emoji}
      ${badgeHtml}
    </div>
    <div class="qv-info">
      <div class="qv-cat">${product.category}</div>
      <div class="qv-name">${product.name}</div>
      <div class="qv-rating">${ratingHtml}</div>
      <div class="qv-price">${priceHtml}</div>
      <p class="qv-desc">${product.description || ''}</p>
      <div class="qv-actions">
        <button class="btn-primary" style="padding:11px 22px" onclick="buyNow('${product.id}')">Buy Now</button>
        <button class="btn-ghost" style="padding:10px 20px" onclick="addToCart('${product.id}', 1)">🛒 Add to Cart</button>
        <a class="btn-ghost" style="padding:10px 20px; text-decoration:none; display:inline-block; text-align:center;" href="product.html?id=${product.id}">Full Details →</a>
      </div>
    </div>
  `;
  overlay.classList.add('open');
}

function closeQuickView(event, forceClose) {
  const overlay = getQuickViewOverlay();
  if (!overlay) return;
  if (forceClose || !event || event.target === overlay) {
    overlay.classList.remove('open');
  }
}
function injectWhatsAppButton() {
  if (document.querySelector('.whatsapp-float')) return; // avoid duplicates

  const style = document.createElement('style');
  style.textContent = `
    .whatsapp-float {
      position: fixed; bottom: 28px; right: 28px; z-index: 500;
      width: 52px; height: 52px; border-radius: 50%;
      background: #25D366; display: flex; align-items: center; justify-content: center;
      color: #fff; box-shadow: 0 4px 20px rgba(37,211,102,0.4);
      transition: transform 0.2s, box-shadow 0.2s; text-decoration: none;
    }
    .whatsapp-float svg { width: 28px; height: 28px; }
    .whatsapp-float:hover { transform: scale(1.08); box-shadow: 0 6px 26px rgba(37,211,102,0.55); }
    @keyframes wa-pulse {
      0% { box-shadow: 0 0 0 0 rgba(37,211,102,0.5); }
      70% { box-shadow: 0 0 0 14px rgba(37,211,102,0); }
      100% { box-shadow: 0 0 0 0 rgba(37,211,102,0); }
    }
    .whatsapp-float::after { content: ''; position: absolute; inset: 0; border-radius: 50%; animation: wa-pulse 2.2s infinite; }
  `;
  document.head.appendChild(style);

  const btn = document.createElement('a');
  btn.href = 'https://wa.me/923000000000?text=Hi%2C%20I%20have%20a%20question%20about%20your%20products';
  btn.className = 'whatsapp-float';
  btn.target = '_blank';
  btn.title = 'Chat on WhatsApp';
  btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 6.32A8.86 8.86 0 0 0 12.05 4a8.94 8.94 0 0 0-7.74 13.4L3 21l3.7-1.27a8.93 8.93 0 0 0 4.34 1.1h.01a8.94 8.94 0 0 0 8.93-8.93 8.87 8.87 0 0 0-2.38-5.58zM12.05 19.4h-.01a7.4 7.4 0 0 1-3.77-1.03l-.27-.16-2.8.95.94-2.73-.18-.28A7.42 7.42 0 1 1 19.5 12a7.45 7.45 0 0 1-7.45 7.4zm4.06-5.56c-.22-.11-1.31-.65-1.51-.72-.2-.07-.35-.11-.5.11-.15.22-.57.72-.7.87-.13.15-.26.16-.48.05-.22-.11-.93-.34-1.78-1.1-.66-.59-1.1-1.31-1.23-1.53-.13-.22-.01-.34.1-.45.1-.1.22-.26.33-.4.11-.13.15-.22.22-.37.07-.15.04-.28-.02-.39-.06-.11-.5-1.21-.69-1.66-.18-.43-.37-.37-.5-.38h-.43c-.15 0-.39.05-.59.28-.2.22-.78.76-.78 1.86s.8 2.16.91 2.31c.11.15 1.57 2.4 3.81 3.36.53.23.95.37 1.27.47.53.17 1.02.15 1.4.09.43-.06 1.31-.53 1.49-1.05.18-.51.18-.95.13-1.05-.05-.1-.2-.16-.42-.27z"/></svg>`;
  document.body.appendChild(btn);
}

// run on every page that loads shared.js — handles case where DOMContentLoaded already fired
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectWhatsAppButton);
} else {
  injectWhatsAppButton();
}

/* ══════════════════════════════════════════════════════════
   PROJECT RESOURCE LAYER
   Mirrors the product resource layer above, but for the
   "Projects" section (FYP / Arduino / IoT / Robotics / Drone /
   3D Printing / Smart Home build guides).
═════════════════════════════════════════════════════════════ */
let PROJECTS_CACHE = null;

const PROJECT_CATEGORIES = [
  { id: 'fyp', name: 'Final Year Projects', emoji: '🎓', count: 18, description: 'Complete FYP solutions' },
  { id: 'arduino-projects', name: 'Arduino Projects', emoji: '🔌', count: 24, description: 'Mini & semester builds' },
  { id: 'iot', name: 'IoT Projects', emoji: '📡', count: 15, description: 'Connected device builds' },
  { id: 'robotics-projects', name: 'Robotics Projects', emoji: '🤖', count: 12, description: 'Autonomous & remote bots' },
  { id: 'drone-projects', name: 'Drone Projects', emoji: '🚁', count: 9, description: 'Custom-built quadcopters' },
  { id: '3dprint-projects', name: '3D Printing Projects', emoji: '🖨️', count: 10, description: 'Printed mechanisms & models' },
  { id: 'smarthome-projects', name: 'Smart Home Projects', emoji: '🏠', count: 11, description: 'Home automation builds' },
];

const PROJECTS = [
  {
    id: 'pr1', categoryId: 'fyp', category: 'Final Year Projects', emoji: '🎓',
    name: 'Smart Agriculture Monitoring System', difficulty: 'Advanced', duration: '6–8 Weeks',
    rating: 4.8, reviews: 142, badge: 'POPULAR',
    description: 'A complete FYP-ready system that monitors soil moisture, temperature, and humidity, then automates irrigation through a cloud dashboard.',
    components: ['ESP32 Dev Board', 'Soil Moisture Sensor', 'DHT22', 'Relay Module', 'Water Pump'],
    features: ['Cloud Dashboard', 'Auto Irrigation', 'Mobile Alerts', 'Solar-Powered Option']
  },
  {
    id: 'pr2', categoryId: 'arduino-projects', category: 'Arduino Projects', emoji: '🔌',
    name: 'Obstacle-Avoiding Robot Car', difficulty: 'Beginner', duration: '1–2 Weeks',
    rating: 4.6, reviews: 318, badge: 'NEW',
    description: 'A classic semester project: an Arduino-driven car that detects obstacles with an ultrasonic sensor and reroutes itself automatically.',
    components: ['Arduino Uno', 'Ultrasonic Sensor', 'L298N Motor Driver', 'Chassis Kit', '4x DC Motors'],
    features: ['Auto Obstacle Detection', 'Beginner-Friendly Wiring', 'Open-Source Code', 'Battery Powered']
  },
  {
    id: 'pr3', categoryId: 'iot', category: 'IoT Projects', emoji: '📡',
    name: 'Home Energy Usage Tracker', difficulty: 'Intermediate', duration: '3–4 Weeks',
    rating: 4.7, reviews: 96, badge: null,
    description: 'Track real-time power consumption of household appliances and view usage trends through a live IoT web dashboard.',
    components: ['ESP8266 NodeMCU', 'Current Sensor (ACS712)', 'Voltage Sensor', 'OLED Display'],
    features: ['Live Web Dashboard', 'Usage Alerts', 'Historical Graphs', 'Wi-Fi Connectivity']
  },
  {
    id: 'pr4', categoryId: 'robotics-projects', category: 'Robotics Projects', emoji: '🤖',
    name: 'Robotic Arm with Gesture Control', difficulty: 'Advanced', duration: '5–7 Weeks',
    rating: 4.9, reviews: 71, badge: 'POPULAR',
    description: 'A 4-DOF robotic arm controlled wirelessly through hand gestures captured by an accelerometer-equipped glove.',
    components: ['Arduino Mega', '4x Servo Motors', 'MPU6050 Gyroscope', 'NRF24L01 RF Module', '3D-Printed Arm'],
    features: ['Gesture-Based Control', 'Wireless Operation', '4 Degrees of Freedom', 'Smooth PWM Motion']
  },
  {
    id: 'pr5', categoryId: 'drone-projects', category: 'Drone Projects', emoji: '🚁',
    name: 'Custom FPV Racing Quadcopter', difficulty: 'Advanced', duration: '4–6 Weeks',
    rating: 4.8, reviews: 58, badge: 'NEW',
    description: 'Build a lightweight, agile FPV racing drone from scratch with a tuned flight controller and live first-person video feed.',
    components: ['F4 Flight Controller', '4x Brushless Motors', 'FPV Camera & VTX', 'Carbon Fiber Frame', 'LiPo Battery'],
    features: ['Live FPV Feed', 'Tunable PID Flight', 'Lightweight Frame', 'Racing-Grade Speed']
  },
  {
    id: 'pr6', categoryId: '3dprint-projects', category: '3D Printing Projects', emoji: '🖨️',
    name: 'Articulated Prosthetic Hand', difficulty: 'Intermediate', duration: '3–5 Weeks',
    rating: 4.7, reviews: 84, badge: null,
    description: 'A fully 3D-printed, tendon-actuated prosthetic hand prototype, ideal for biomedical engineering FYPs and research demos.',
    components: ['PLA/PETG Filament', 'Fishing Line (Tendons)', 'Servo Motors', 'Flex Sensors', 'Microcontroller'],
    features: ['Tendon-Driven Fingers', 'Flex Sensor Control', 'Lightweight Printed Parts', 'Modular Design']
  },
  {
    id: 'pr7', categoryId: 'smarthome-projects', category: 'Smart Home Projects', emoji: '🏠',
    name: 'Voice-Controlled Home Automation Hub', difficulty: 'Intermediate', duration: '3–4 Weeks',
    rating: 4.6, reviews: 203, badge: 'POPULAR',
    description: 'Control lights, fans, and appliances using voice commands and a mobile app, built around a central Wi-Fi automation hub.',
    components: ['ESP32', 'Relay Modules', 'Mic Module', 'Mobile App (Blynk)', 'Wi-Fi Router'],
    features: ['Voice Commands', 'Mobile App Control', 'Schedule Automation', 'Multi-Device Support']
  },
  {
    id: 'pr8', categoryId: 'iot', category: 'IoT Projects', emoji: '📡',
    name: 'IoT-Based Smart Parking System', difficulty: 'Intermediate', duration: '4–5 Weeks',
    rating: 4.5, reviews: 67, badge: null,
    description: 'Detect free parking slots using IR sensors and display real-time availability on a web app and entrance LED board.',
    components: ['Arduino Uno', 'IR Sensors', 'ESP8266', 'LED Matrix Display', 'Cloud Database'],
    features: ['Real-Time Slot Detection', 'Web Dashboard', 'LED Entrance Display', 'Scalable to Multi-Floor']
  },
];

async function loadProjects() {
  if (PROJECTS_CACHE) return PROJECTS_CACHE;
  try {
    const res = await fetch('projects.json');
    if (res.ok) {
      PROJECTS_CACHE = await res.json();
      return PROJECTS_CACHE;
    }
  } catch (e) { /* Fallback to hardcoded fallback definitions */ }

  PROJECTS_CACHE = { categories: PROJECT_CATEGORIES, projects: PROJECTS };
  return PROJECTS_CACHE;
}

async function getProjectById(id) {
  const { projects } = await loadProjects();
  return projects.find(p => p.id === id) || null;
}

function goToProjectCategory(categoryId) {
  window.location.href = `projects.html?category=${encodeURIComponent(categoryId)}`;
}

function goToProject(projectId) {
  window.location.href = `projects.html?id=${encodeURIComponent(projectId)}`;
}

/* ---------- UI RENDER ENGINE: PROJECT CARDS ---------- */
function buildProjectCard(project) {
  const card = document.createElement('div');
  card.className = 'product-card';
  card.onclick = () => openProjectQuickView(project.id);

  const badgeHtml = project.badge
    ? `<span class="${project.badge.includes('%') ? 'badge-sale' : 'badge-new'}">${project.badge}</span>`
    : '';

  const entireStars = Math.floor(project.rating || 0);
  const hasHalfStar = (project.rating || 0) % 1 !== 0;
  const ratingHtml = project.rating
    ? '★'.repeat(entireStars) + (hasHalfStar ? '☆' : '') + ` <span>(${project.rating} · ${(project.reviews || 0).toLocaleString()} reviews)</span>`
    : `<span>No reviews yet</span>`;

  card.innerHTML = `
    <div class="product-img">
      ${project.emoji}
      ${badgeHtml}
    </div>
    <div class="product-info">
      <div class="product-cat">${project.category}</div>
      <div class="product-name" style="cursor:pointer">${project.name}</div>
      <div class="product-rating">${ratingHtml}</div>
      <div class="product-footer">
        <div class="product-price" style="font-size:0.82rem">${project.difficulty} · ${project.duration}</div>
      </div>
      <div class="product-actions">
        <button class="btn-buy-now" onclick="event.stopPropagation(); openProjectQuickView('${project.id}', event)">View Details</button>
        <button class="btn-quick-view" onclick="event.stopPropagation(); addToCart && null">Get Quote</button>
      </div>
    </div>
  `;
  return card;
}

/* ---------- UI RENDER ENGINE: PROJECT QUICK VIEW ---------- */
async function openProjectQuickView(projectId, event) {
  if (event) event.stopPropagation();
  const project = await getProjectById(projectId);
  if (!project) return;

  const overlay = getQuickViewOverlay();
  const body = document.getElementById('qvBody');
  if (!overlay || !body) return;

  const badgeHtml = project.badge
    ? `<span class="${project.badge.includes('%') ? 'badge-sale' : 'badge-new'}">${project.badge}</span>`
    : '';

  const entireStars = Math.floor(project.rating || 0);
  const hasHalfStar = (project.rating || 0) % 1 !== 0;
  const ratingHtml = project.rating
    ? '★'.repeat(entireStars) + (hasHalfStar ? '☆' : '') + ` <span>(${project.rating} · ${(project.reviews || 0).toLocaleString()} reviews)</span>`
    : `<span>No reviews yet</span>`;

  const componentsHtml = (project.components || []).map(c => `<li>${c}</li>`).join('');

  body.innerHTML = `
    <div class="qv-img" style="display:flex;align-items:center;justify-content:center;font-size:5rem">
      ${project.emoji}
      ${badgeHtml}
    </div>
    <div class="qv-info">
      <div class="qv-cat">${project.category}</div>
      <div class="qv-name">${project.name}</div>
      <div class="qv-rating">${ratingHtml}</div>
      <div class="qv-price">${project.difficulty} · ${project.duration}</div>
      <p class="qv-desc">${project.description || ''}</p>
      ${componentsHtml ? `<p class="qv-desc" style="margin-top:-4px"><strong style="color:var(--text)">Key Components:</strong> ${(project.components || []).join(', ')}</p>` : ''}
      <div class="qv-actions">
        <a class="btn-primary" style="padding:11px 22px; text-decoration:none; display:inline-block; text-align:center;" href="#contact">Request Source Code</a>
        <button class="btn-ghost" style="padding:10px 20px" onclick="closeQuickView(null, true)">Close</button>
      </div>
    </div>
  `;
  overlay.classList.add('open');
}