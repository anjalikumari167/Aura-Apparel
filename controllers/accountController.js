const { Order, OrderItem, Product, WishlistItem } = require('../models');
const { asyncHandler, HttpError } = require('../utils/helpers');
const { cleanShipping } = require('../utils/validators');

const orderInclude = [
  { model: OrderItem, as: 'items', include: [{ model: Product, as: 'product', attributes: ['id', 'images'] }] },
];

exports.orders = asyncHandler(async (req, res) => {
  const orders = await Order.findAll({
    where: { userId: req.user.id },
    include: orderInclude,
    order: [['createdAt', 'DESC'], [{ model: OrderItem, as: 'items' }, 'id', 'ASC']],
  });
  res.render('pages/orders', { title: 'My orders', orders });
});

exports.confirmation = asyncHandler(async (req, res, next) => {
  const order = await Order.findOne({
    where: { id: parseInt(req.params.id, 10) || 0, userId: req.user.id },
    include: orderInclude,
  });
  if (!order) return next();
  res.render('pages/order-confirmation', { title: `Order #${order.id} confirmed`, order });
});

exports.wishlist = asyncHandler(async (req, res) => {
  const rows = await WishlistItem.findAll({
    where: { userId: req.user.id },
    include: [{ model: Product, as: 'product' }],
    order: [['createdAt', 'DESC']],
  });
  const products = rows.map((r) => r.product).filter(Boolean);
  res.render('pages/wishlist', { title: 'Wishlist', products, wishlistIds: products.map((p) => p.id) });
});

exports.accountPage = (req, res) => {
  res.render('pages/account', { title: 'My account' });
};

exports.updateAccount = asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) throw new HttpError(400, 'Name cannot be empty');
  const phone = String(req.body.phone || '').trim().slice(0, 30);

  const addr = req.body.defaultAddress || {};
  const hasAddress = Object.values(addr).some((v) => String(v || '').trim());
  const defaultAddress = hasAddress ? cleanShipping(addr) : null; // validated like checkout

  await req.user.update({ name, phone: phone || null, defaultAddress });
  res.json({ message: 'Profile saved', user: req.user.toSafeJSON() });
});
