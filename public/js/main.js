/* AURA APPAREL — client-side behaviour (vanilla JS, no page reloads for cart / wishlist / filters) */
(function () {
  'use strict';

  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  const loggedIn = document.body.dataset.loggedIn === 'true';
  const moneyFmt = new Intl.NumberFormat(document.body.dataset.locale || 'en-US', {
    style: 'currency',
    currency: document.body.dataset.currency || 'USD',
  });
  const fmt = (n) => moneyFmt.format(Number(n) || 0);
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- toast notifications ---------- */
  function toast(message, type) {
    const root = $('#toast-root');
    if (!root) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (type || 'info');
    el.setAttribute('role', 'status');
    el.textContent = message;
    root.appendChild(el);
    setTimeout(() => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 260);
    }, 3200);
  }

  /* ---------- fetch wrapper: JSON in, JSON out, errors become exceptions ---------- */
  async function api(url, opts) {
    opts = opts || {};
    const res = await fetch(url, {
      method: opts.method || 'GET',
      credentials: 'same-origin',
      headers: Object.assign(
        { Accept: 'application/json', 'X-Requested-With': 'fetch' },
        opts.body ? { 'Content-Type': 'application/json' } : {}
      ),
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      /* non-JSON response */
    }
    if (!res.ok) {
      const err = new Error((data && data.error) || 'Something went wrong. Please try again.');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  const loginUrl = () => '/login?next=' + encodeURIComponent(location.pathname + location.search);
  window.Aura = { $, $$, toast, api, fmt, esc, loggedIn };

  /* =====================================================================
     CART DRAWER
     ===================================================================== */
  const drawer = $('#cart-drawer');
  const overlay = $('#cart-overlay');
  const itemsEl = $('#cart-items');
  const footerEl = $('#cart-footer');
  let cart = null;

  function openCart() {
    drawer.classList.remove('translate-x-full');
    overlay.classList.remove('opacity-0', 'pointer-events-none');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('overflow-hidden');
    loadCart();
  }
  function closeCart() {
    drawer.classList.add('translate-x-full');
    overlay.classList.add('opacity-0', 'pointer-events-none');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('overflow-hidden');
  }

  async function loadCart() {
    itemsEl.innerHTML = '<div class="py-10 space-y-4">' + '<div class="h-20 bg-neutral-100 animate-pulse"></div>'.repeat(2) + '</div>';
    try {
      cart = await api('/api/cart');
      renderCart();
    } catch (e) {
      itemsEl.innerHTML = '<p class="py-10 text-center text-sm text-neutral-500">Could not load your cart.</p>';
      toast(e.message, 'error');
    }
  }

  function setBadge(count) {
    $$('[data-cart-count]').forEach((b) => {
      b.textContent = count;
      b.classList.toggle('hidden', !count);
    });
    const t = $('[data-cart-count-text]');
    if (t) t.textContent = count;
  }

  function renderCart() {
    setBadge(cart.count);
    if (!cart.items.length) {
      footerEl.classList.add('hidden');
      itemsEl.innerHTML =
        '<div class="h-full flex flex-col items-center justify-center text-center py-20">' +
        '<p class="font-serif text-3xl mb-2">Your cart is empty</p>' +
        '<p class="text-sm text-neutral-500 mb-6">Looks like you haven\'t added anything yet.</p>' +
        '<a href="/shop" class="bg-black text-white px-8 py-3 text-sm tracking-widest hover:bg-neutral-800 transition">START SHOPPING</a></div>';
      return;
    }

    itemsEl.innerHTML =
      '<ul class="divide-y divide-neutral-100">' +
      cart.items
        .map((i) => {
          const meta = [i.size, i.color].filter(Boolean).join(' · ');
          const onSale = i.originalPrice > i.unitPrice;
          return (
            '<li class="flex gap-4 py-4" data-line="' + esc(i.lineId) + '">' +
            '<a href="/product/' + i.productId + '"><img src="' + esc(i.image) + '" alt="" onerror="this.onerror=null;this.src=\'/img/placeholder.svg\'" class="w-20 h-24 object-cover bg-neutral-100"></a>' +
            '<div class="flex-1 text-sm">' +
            '<div class="flex justify-between gap-2"><a href="/product/' + i.productId + '" class="hover:underline">' + esc(i.name) + '</a>' +
            '<button type="button" data-remove class="text-neutral-400 hover:text-black text-lg leading-none" aria-label="Remove ' + esc(i.name) + '">&times;</button></div>' +
            (meta ? '<p class="text-xs text-neutral-500 mt-0.5">' + esc(meta) + '</p>' : '') +
            '<p class="mt-1">' + fmt(i.unitPrice) + (onSale ? ' <span class="text-xs text-neutral-400 line-through">' + fmt(i.originalPrice) + '</span>' : '') + '</p>' +
            '<div class="mt-2 flex items-center justify-between">' +
            '<div class="inline-flex items-center border border-neutral-300">' +
            '<button type="button" data-qty="dec" class="w-8 h-8 hover:bg-neutral-100" aria-label="Decrease quantity">−</button>' +
            '<span class="w-8 text-center text-sm">' + i.quantity + '</span>' +
            '<button type="button" data-qty="inc" class="w-8 h-8 hover:bg-neutral-100 disabled:opacity-30" aria-label="Increase quantity"' + (i.quantity >= Math.min(10, i.stock) ? ' disabled' : '') + '>+</button></div>' +
            '<span class="font-medium">' + fmt(i.lineTotal) + '</span></div>' +
            (i.stock < i.quantity ? '<p class="text-xs text-red-600 mt-1">Only ' + i.stock + ' in stock</p>' : '') +
            '</div></li>'
          );
        })
        .join('') +
      '</ul>';

    // promo area
    $('#promo-area').innerHTML = cart.promo
      ? '<div class="flex items-center justify-between bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">' +
        '<span>✓ <strong>' + esc(cart.promo.code) + '</strong> — ' + cart.promo.percent + '% off</span>' +
        '<button type="button" id="promo-remove" class="text-xs underline">Remove</button></div>'
      : '<form id="promo-form" class="flex gap-2"><input id="promo-input" type="text" placeholder="Promo code" autocomplete="off" ' +
        'class="flex-1 border border-neutral-300 px-3 py-2 text-sm uppercase outline-none focus:border-black">' +
        '<button type="submit" class="border border-black px-4 text-sm hover:bg-black hover:text-white transition">APPLY</button></form>';

    $('#cart-subtotal').textContent = fmt(cart.subtotal);
    $('#cart-discount').textContent = '−' + fmt(cart.discount);
    $('#cart-discount-row').classList.toggle('hidden', !cart.promo);
    $('#cart-total').textContent = fmt(cart.total);
    $('#checkout-link').setAttribute('href', loggedIn ? '/checkout' : '/login?next=%2Fcheckout');
    footerEl.classList.remove('hidden');
  }

  async function cartAction(url, body, okMessage) {
    try {
      const data = await api(url, { method: 'POST', body: body });
      cart = data;
      renderCart();
      if (okMessage || data.message) toast(okMessage || data.message, 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  if (drawer) {
    $('#open-cart').addEventListener('click', openCart);
    $('#close-cart').addEventListener('click', closeCart);
    overlay.addEventListener('click', closeCart);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeCart();
    });

    itemsEl.addEventListener('click', (e) => {
      const row = e.target.closest('[data-line]');
      if (!row) return;
      const lineId = row.dataset.line;
      const line = cart && cart.items.find((i) => i.lineId === lineId);
      if (e.target.closest('[data-remove]')) return cartAction('/api/cart/remove', { lineId: lineId });
      const q = e.target.closest('[data-qty]');
      if (q && line) {
        const next = line.quantity + (q.dataset.qty === 'inc' ? 1 : -1);
        cartAction('/api/cart/update', { lineId: lineId, quantity: next }, null);
      }
    });

    footerEl.addEventListener('submit', (e) => {
      if (e.target.id !== 'promo-form') return;
      e.preventDefault();
      const code = $('#promo-input').value.trim();
      if (!code) return toast('Enter a promo code', 'error');
      cartAction('/api/cart/promo', { code: code });
    });
    footerEl.addEventListener('click', (e) => {
      if (e.target.id === 'promo-remove') cartAction('/api/cart/promo/remove', {});
    });
  }

  /* =====================================================================
     WISHLIST (heart buttons on cards + product page)
     ===================================================================== */
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-wishlist]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    if (!loggedIn) {
      toast('Please log in to use your wishlist', 'info');
      setTimeout(() => (location.href = loginUrl()), 900);
      return;
    }
    const id = btn.dataset.wishlist;
    btn.disabled = true;
    try {
      const r = await api('/api/wishlist/toggle', { method: 'POST', body: { productId: id } });
      $$('[data-wishlist="' + id + '"]').forEach((b) => b.classList.toggle('is-active', r.wishlisted));
      toast(r.message, 'success');
      const grid = $('#wishlist-grid');
      if (grid && !r.wishlisted) {
        const card = btn.closest('article');
        if (card) card.remove();
        if (!grid.children.length) location.reload();
      }
    } catch (err) {
      if (err.status === 401) location.href = loginUrl();
      else toast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  /* =====================================================================
     SHOP: live search / filters / sorting (replaces the grid via fetch)
     ===================================================================== */
  const filterForm = $('#filter-form');
  if (filterForm) {
    const grid = $('#product-grid');
    const counter = $('#result-count');
    let timer = null;
    let controller = null;

    const skeleton = () => {
      grid.innerHTML = Array.from({ length: 6 })
        .map(() => '<div class="animate-pulse"><div class="aspect-[3/4] bg-neutral-200"></div><div class="h-3 bg-neutral-200 mt-3 w-1/3"></div><div class="h-4 bg-neutral-200 mt-2 w-3/4"></div><div class="h-4 bg-neutral-200 mt-2 w-1/4"></div></div>')
        .join('');
    };

    const queryString = () => {
      const p = new URLSearchParams();
      new FormData(filterForm).forEach((v, k) => {
        if (String(v).trim() !== '') p.append(k, v);
      });
      return p.toString();
    };

    async function refresh() {
      const qs = queryString();
      history.replaceState(null, '', qs ? '/shop?' + qs : '/shop');
      if (controller) controller.abort();
      controller = new AbortController();
      skeleton();
      try {
        const res = await fetch('/shop/grid' + (qs ? '?' + qs : ''), {
          signal: controller.signal,
          credentials: 'same-origin',
          headers: { 'X-Requested-With': 'fetch' },
        });
        if (!res.ok) throw new Error('Could not load products');
        grid.innerHTML = await res.text();
        const c = grid.querySelector('[data-count]');
        if (c && counter) counter.textContent = c.dataset.count + (c.dataset.count === '1' ? ' item' : ' items');
      } catch (err) {
        if (err.name === 'AbortError') return;
        grid.innerHTML = '<p class="col-span-full text-center py-20 text-neutral-500">' + esc(err.message) + '</p>';
        toast(err.message, 'error');
      }
    }

    filterForm.addEventListener('input', (e) => {
      clearTimeout(timer);
      const typing = e.target.name === 'search' || e.target.type === 'number';
      timer = setTimeout(refresh, typing ? 350 : 0);
    });
    filterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      refresh();
    });
    $('#clear-filters').addEventListener('click', () => {
      $$('input[type=checkbox]', filterForm).forEach((c) => (c.checked = false));
      $$('input[type=search], input[type=number]', filterForm).forEach((i) => (i.value = ''));
      $('select[name=sort]', filterForm).value = 'newest';
      refresh();
    });
    const toggle = $('#filter-toggle');
    if (toggle) toggle.addEventListener('click', () => filterForm.classList.toggle('hidden'));
  }

  /* =====================================================================
     PRODUCT PAGE: gallery, size/color validation, add to cart
     ===================================================================== */
  const page = $('#product-page');
  if (page) {
    const hasSizes = page.dataset.hasSizes === 'true';
    const hasColors = page.dataset.hasColors === 'true';
    const stock = parseInt(page.dataset.stock, 10) || 0;
    let size = '';
    let color = page.dataset.defaultColor || '';
    const qtyInput = $('#qty');

    // gallery
    $$('[data-thumb]', page).forEach((t) =>
      t.addEventListener('click', () => {
        $('#main-image').src = t.dataset.src;
        $$('[data-thumb]', page).forEach((o) => {
          o.classList.toggle('border-black', o === t);
          o.classList.toggle('border-transparent', o !== t);
        });
      })
    );

    // size + color pickers
    $$('[data-size]', page).forEach((b) =>
      b.addEventListener('click', () => {
        size = b.dataset.size;
        $$('[data-size]', page).forEach((o) => o.classList.toggle('is-selected', o === b));
        $('#size-label').textContent = size;
        $('#size-error').classList.add('hidden');
      })
    );
    $$('[data-color]', page).forEach((b) =>
      b.addEventListener('click', () => {
        color = b.dataset.color;
        $$('[data-color]', page).forEach((o) => o.classList.toggle('is-selected', o === b));
        $('#color-label').textContent = color;
      })
    );

    // quantity
    const maxQty = Math.min(10, Math.max(stock, 1));
    $('#qty-dec').addEventListener('click', () => (qtyInput.value = Math.max(1, parseInt(qtyInput.value, 10) - 1)));
    $('#qty-inc').addEventListener('click', () => (qtyInput.value = Math.min(maxQty, parseInt(qtyInput.value, 10) + 1)));

    // add to cart (blocked until a size is chosen)
    const addBtn = $('#add-to-cart');
    addBtn.addEventListener('click', async () => {
      if (hasSizes && !size) {
        $('#size-error').classList.remove('hidden');
        const opts = $('#size-options');
        opts.classList.remove('shake');
        void opts.offsetWidth; // restart the animation
        opts.classList.add('shake');
        toast('Please select a size', 'error');
        return;
      }
      if (hasColors && !color) return toast('Please select a color', 'error');

      addBtn.disabled = true;
      const label = addBtn.textContent;
      addBtn.textContent = 'ADDING…';
      try {
        const data = await api('/api/cart/add', {
          method: 'POST',
          body: { productId: page.dataset.productId, size: size, color: color, quantity: parseInt(qtyInput.value, 10) || 1 },
        });
        cart = data;
        setBadge(data.count);
        toast(data.message, 'success');
        openCart();
      } catch (e) {
        toast(e.message, 'error');
      } finally {
        addBtn.disabled = false;
        addBtn.textContent = label;
      }
    });
  }

  /* =====================================================================
     ACCOUNT: profile + saved address
     ===================================================================== */
  const accountForm = $('#account-form');
  if (accountForm) {
    accountForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(accountForm);
      const addr = {};
      ['name', 'phone', 'line1', 'line2', 'city', 'state', 'postalCode', 'country'].forEach((k) => (addr[k] = (f.get('addr_' + k) || '').trim()));
      // "country" is pre-filled; if nothing else was typed, treat the address as empty
      const onlyCountry = Object.keys(addr).every((k) => k === 'country' || !addr[k]);
      const btn = $('button[type=submit]', accountForm);
      btn.disabled = true;
      try {
        const r = await api('/api/account', {
          method: 'POST',
          body: { name: f.get('name'), phone: f.get('phone'), defaultAddress: onlyCountry ? {} : addr },
        });
        toast(r.message, 'success');
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }

  // Keep the badge fresh when returning with the back button
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) location.reload();
  });
})();
