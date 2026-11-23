const { Product, PromoCode, WishlistItem } = require('../models');
const cartService = require('../utils/cartService');
const { asyncHandler, HttpError } = require('../utils/helpers');

exports.getCart = asyncHandler(async (req, res) => {
  res.json(await cartService.getCartPayload(req));
});

exports.add = asyncHandler(async (req, res) => {
  const { product, capped, max } = await cartService.addItem(req, req.body || {});
  const payload = await cartService.getCartPayload(req);
  res.json({
    ...payload,
    message: capped ? `Only ${max} available — quantity adjusted` : `${product.name} added to your cart`,
  });
});

exports.update = asyncHandler(async (req, res) => {
  await cartService.setQuantity(req, String(req.body.lineId || ''), req.body.quantity);
  res.json(await cartService.getCartPayload(req));
});

exports.remove = asyncHandler(async (req, res) => {
  await cartService.removeLine(req, String(req.body.lineId || ''));
  res.json({ ...(await cartService.getCartPayload(req)), message: 'Item removed' });
});

/** Promo codes are validated against the promo_codes table in the database. */
exports.applyPromo = asyncHandler(async (req, res) => {
  const code = String(req.body.code || '').trim();
  if (!code) throw new HttpError(400, 'Enter a promo code');
  const promo = await PromoCode.findActive(code);
  if (!promo) throw new HttpError(400, 'Invalid or expired promo code');
  req.session.promoCode = promo.code;
  res.json({
    ...(await cartService.getCartPayload(req)),
    message: `${promo.code} applied — ${promo.discountPercent}% off`,
  });
});

exports.removePromo = asyncHandler(async (req, res) => {
  delete req.session.promoCode;
  res.json({ ...(await cartService.getCartPayload(req)), message: 'Promo code removed' });
});

exports.toggleWishlist = asyncHandler(async (req, res) => {
  const productId = parseInt(req.body.productId, 10) || 0;
  const product = await Product.findByPk(productId);
  if (!product) throw new HttpError(404, 'Product not found');

  const existing = await WishlistItem.findOne({ where: { userId: req.user.id, productId } });
  if (existing) {
    await existing.destroy();
    return res.json({ wishlisted: false, message: 'Removed from wishlist' });
  }
  await WishlistItem.create({ userId: req.user.id, productId });
  res.json({ wishlisted: true, message: 'Saved to your wishlist' });
});
