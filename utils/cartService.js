// =====================================================================
// Cart logic shared by the cart API and checkout.
//  - Guests:      cart lives in req.session.cart  (session is stored in the SQL `sessions` table)
//  - Logged in:   cart lives in the `cart_items` table
//  - On login the guest cart is merged into cart_items (see mergeGuestCart)
// =====================================================================
const { Op } = require('sequelize');
const { Product, CartItem, PromoCode } = require('../models');
const { HttpError } = require('./helpers');

const MAX_QTY = 10;
const keyOf = (i) => `${i.productId}|${i.size || ''}|${i.color || ''}`;
const clampQty = (q) => Math.min(Math.max(parseInt(q, 10) || 1, 1), MAX_QTY);

function toLine(lineId, product, row) {
  const unit = product.effectivePrice;
  return {
    lineId,
    productId: product.id,
    name: product.name,
    image: product.images[0] || '',
    size: row.size,
    color: row.color,
    quantity: row.quantity,
    unitPrice: unit,
    originalPrice: product.price,
    stock: product.stockCount,
    lineTotal: Math.round(unit * 100 * row.quantity) / 100,
  };
}

async function getLines(req) {
  if (req.user) {
    const rows = await CartItem.findAll({
      where: { userId: req.user.id },
      include: [{ model: Product, as: 'product' }],
      order: [['createdAt', 'ASC'], ['id', 'ASC']],
    });
    return rows.filter((r) => r.product).map((r) => toLine(String(r.id), r.product, r));
  }
  const cart = req.session.cart || [];
  if (!cart.length) return [];
  const products = await Product.findAll({ where: { id: { [Op.in]: [...new Set(cart.map((i) => i.productId))] } } });
  const byId = new Map(products.map((p) => [p.id, p]));
  req.session.cart = cart.filter((i) => byId.has(i.productId)); // drop lines for deleted products
  return req.session.cart.map((i) => toLine(keyOf(i), byId.get(i.productId), i));
}

/** Returns the active PromoCode row for this session, or null (and forgets stale codes). */
async function getPromo(req) {
  const code = req.session.promoCode;
  if (!code) return null;
  const promo = await PromoCode.findActive(code);
  if (!promo) delete req.session.promoCode;
  return promo;
}

/** Money maths in integer cents to avoid floating point errors. */
function computeTotals(subtotalCents, percent) {
  const discountCents = Math.round((subtotalCents * (percent || 0)) / 100);
  return {
    subtotal: subtotalCents / 100,
    discount: discountCents / 100,
    total: (subtotalCents - discountCents) / 100,
    subtotalCents,
    discountCents,
  };
}

async function getCartPayload(req) {
  const [items, promo] = await Promise.all([getLines(req), getPromo(req)]);
  const subtotalCents = items.reduce((s, l) => s + Math.round(l.unitPrice * 100) * l.quantity, 0);
  const t = computeTotals(subtotalCents, promo ? promo.discountPercent : 0);
  return {
    items,
    count: items.reduce((s, l) => s + l.quantity, 0),
    subtotal: t.subtotal,
    discount: t.discount,
    total: t.total,
    promo: promo ? { code: promo.code, percent: promo.discountPercent } : null,
  };
}

async function addItem(req, body) {
  const product = await Product.findByPk(parseInt(body.productId, 10) || 0);
  if (!product) throw new HttpError(404, 'Product not found');

  const size = String(body.size || '').trim();
  const color = String(body.color || '').trim();
  if (product.sizes.length && !product.sizes.includes(size)) throw new HttpError(400, 'Please select a size');
  if (product.colors.length && !product.colors.includes(color)) throw new HttpError(400, 'Please select a color');
  if (product.stockCount <= 0) throw new HttpError(400, 'Sorry, this item is out of stock');

  const qty = clampQty(body.quantity);
  const max = Math.min(MAX_QTY, product.stockCount);
  let capped = false;

  if (req.user) {
    const where = { userId: req.user.id, productId: product.id, size, color };
    const existing = await CartItem.findOne({ where });
    const wanted = (existing ? existing.quantity : 0) + qty;
    const finalQty = Math.min(wanted, max);
    capped = wanted > max;
    if (existing) await existing.update({ quantity: finalQty });
    else await CartItem.create({ ...where, quantity: finalQty });
  } else {
    const cart = req.session.cart || [];
    const row = cart.find((i) => keyOf(i) === keyOf({ productId: product.id, size, color }));
    const wanted = (row ? row.quantity : 0) + qty;
    const finalQty = Math.min(wanted, max);
    capped = wanted > max;
    if (row) row.quantity = finalQty;
    else cart.push({ productId: product.id, size, color, quantity: finalQty });
    req.session.cart = cart;
  }
  return { product, capped, max };
}

async function setQuantity(req, lineId, quantity) {
  const qty = parseInt(quantity, 10);
  if (Number.isNaN(qty)) throw new HttpError(400, 'Invalid quantity');

  if (req.user) {
    const row = await CartItem.findOne({
      where: { id: parseInt(lineId, 10) || 0, userId: req.user.id },
      include: [{ model: Product, as: 'product' }],
    });
    if (!row) throw new HttpError(404, 'Cart item not found');
    if (qty < 1) return row.destroy();
    return row.update({ quantity: Math.min(qty, MAX_QTY, Math.max(row.product.stockCount, 1)) });
  }

  const cart = req.session.cart || [];
  const idx = cart.findIndex((i) => keyOf(i) === lineId);
  if (idx === -1) throw new HttpError(404, 'Cart item not found');
  if (qty < 1) {
    cart.splice(idx, 1);
  } else {
    const product = await Product.findByPk(cart[idx].productId);
    cart[idx].quantity = Math.min(qty, MAX_QTY, Math.max(product ? product.stockCount : 1, 1));
  }
  req.session.cart = cart;
}

const removeLine = (req, lineId) => setQuantity(req, lineId, 0);

/** Push the guest (session) cart into the user's DB cart. Called right after login/signup. */
async function mergeGuestCart(guestCart, userId) {
  for (const g of guestCart || []) {
    const product = await Product.findByPk(g.productId);
    if (!product || product.stockCount <= 0) continue;
    const max = Math.min(MAX_QTY, product.stockCount);
    const where = { userId, productId: product.id, size: g.size || '', color: g.color || '' };
    const existing = await CartItem.findOne({ where });
    const finalQty = Math.min((existing ? existing.quantity : 0) + clampQty(g.quantity), max);
    if (existing) await existing.update({ quantity: finalQty });
    else await CartItem.create({ ...where, quantity: finalQty });
  }
}

module.exports = { getCartPayload, getPromo, computeTotals, addItem, setQuantity, removeLine, mergeGuestCart, MAX_QTY };
