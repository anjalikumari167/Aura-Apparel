const { sequelize, Product, CartItem, Order, OrderItem, PromoCode } = require('../models');
const cartService = require('../utils/cartService');
const { asyncHandler, HttpError } = require('../utils/helpers');
const { cleanShipping } = require('../utils/validators');

const PAYMENT_METHODS = ['Card (Simulated)', 'UPI (Simulated)', 'Cash on Delivery'];

exports.checkoutPage = asyncHandler(async (req, res) => {
  const cart = await cartService.getCartPayload(req);
  if (!cart.items.length) return res.redirect('/shop');
  res.render('pages/checkout', { title: 'Checkout', cart, paymentMethods: PAYMENT_METHODS });
});

/**
 * PLACE ORDER — one SQL transaction. If ANY step fails, everything is rolled back:
 *   1. lock the product rows (so two buyers can't oversell the same stock)
 *   2. verify stock, recompute prices + promo on the server (never trust the browser)
 *   3. INSERT order + order_items
 *   4. DECREMENT products.stockCount
 *   5. DELETE the user's cart_items
 */
exports.placeOrder = asyncHandler(async (req, res) => {
  const shipping = cleanShipping(req.body.shipping);
  const paymentMethod = PAYMENT_METHODS.includes(req.body.paymentMethod) ? req.body.paymentMethod : PAYMENT_METHODS[0];
  const promoCode = req.session.promoCode || null;
  const userId = req.user.id;

  const order = await sequelize.transaction(async (t) => {
    const cartRows = await CartItem.findAll({ where: { userId }, order: [['productId', 'ASC'], ['id', 'ASC']], transaction: t });
    if (!cartRows.length) throw new HttpError(400, 'Your cart is empty');

    const products = await Product.findAll({
      where: { id: cartRows.map((r) => r.productId) },
      order: [['id', 'ASC']],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    // Total quantity wanted per product (the same product can be in the cart in several sizes)
    const wanted = new Map();
    for (const row of cartRows) wanted.set(row.productId, (wanted.get(row.productId) || 0) + row.quantity);
    for (const [pid, qty] of wanted) {
      const p = byId.get(pid);
      if (!p) throw new HttpError(409, 'An item in your cart is no longer available');
      if (p.stockCount < qty) {
        throw new HttpError(
          409,
          p.stockCount === 0 ? `"${p.name}" just sold out` : `Only ${p.stockCount} left of "${p.name}" — please reduce the quantity`
        );
      }
    }

    let percent = 0;
    let appliedCode = null;
    if (promoCode) {
      const promo = await PromoCode.findActive(promoCode, { transaction: t });
      if (!promo) throw new HttpError(400, 'Your promo code is no longer valid. Please remove it and try again.');
      percent = promo.discountPercent;
      appliedCode = promo.code;
    }

    const subtotalCents = cartRows.reduce((s, r) => s + Math.round(byId.get(r.productId).effectivePrice * 100) * r.quantity, 0);
    const totals = cartService.computeTotals(subtotalCents, percent);

    const created = await Order.create(
      {
        userId,
        totalAmount: totals.total,
        discountApplied: totals.discount,
        promoCode: appliedCode,
        shippingAddress: shipping,
        paymentMethod,
        status: 'Processing',
      },
      { transaction: t }
    );

    await OrderItem.bulkCreate(
      cartRows.map((r) => {
        const p = byId.get(r.productId);
        return {
          orderId: created.id,
          productId: p.id,
          productName: p.name,
          size: r.size,
          color: r.color,
          quantity: r.quantity,
          priceAtPurchase: p.effectivePrice,
        };
      }),
      { transaction: t }
    );

    for (const [pid, qty] of wanted) {
      await byId.get(pid).decrement('stockCount', { by: qty, transaction: t });
    }

    await CartItem.destroy({ where: { userId }, transaction: t });
    return created;
  });

  delete req.session.promoCode;
  if (req.body.saveAddress) {
    await req.user.update({ defaultAddress: shipping, phone: req.user.phone || shipping.phone });
  }
  res.json({ orderId: order.id, redirect: `/orders/${order.id}/confirmation` });
});
