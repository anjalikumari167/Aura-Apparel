const { Op } = require('sequelize');
const { Product, Order, OrderItem, User } = require('../models');
const { asyncHandler, HttpError } = require('../utils/helpers');

const ADMIN_STATUSES = ['Processing', 'Shipped', 'Delivered'];

exports.dashboard = asyncHandler(async (req, res) => {
  const [products, orders, revenue] = await Promise.all([
    Product.findAll({ order: [['createdAt', 'DESC'], ['id', 'DESC']] }),
    Order.findAll({
      include: [
        { model: User, as: 'customer', attributes: ['id', 'name', 'email', 'phone'] },
        { model: OrderItem, as: 'items' },
      ],
      order: [['createdAt', 'DESC'], [{ model: OrderItem, as: 'items' }, 'id', 'ASC']],
    }),
    Order.sum('totalAmount', { where: { status: { [Op.ne]: 'Cancelled' } } }),
  ]);
  const stats = {
    products: products.length,
    orders: orders.length,
    pending: orders.filter((o) => o.status === 'Processing').length,
    revenue: Number(revenue) || 0,
    lowStock: products.filter((p) => p.stockCount <= 5).length,
  };
  res.render('admin/index', { title: 'Admin', products, orders, stats, statuses: ADMIN_STATUSES });
});

exports.createProduct = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const price = Number(b.price);
  if (!String(b.name || '').trim()) throw new HttpError(400, 'Product name is required');
  if (!String(b.category || '').trim()) throw new HttpError(400, 'Category is required');
  if (!Number.isFinite(price) || price <= 0) throw new HttpError(400, 'Enter a valid price');

  const discount = b.discountPrice === '' || b.discountPrice == null ? null : Number(b.discountPrice);
  if (discount !== null && (!Number.isFinite(discount) || discount <= 0)) throw new HttpError(400, 'Enter a valid discount price');

  const images = String(b.images || '')
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s));
  if (!images.length) throw new HttpError(400, 'Add at least one image URL (starting with http:// or https://)');

  const stock = parseInt(b.stockCount, 10);
  if (!Number.isInteger(stock) || stock < 0) throw new HttpError(400, 'Stock must be 0 or more');

  const product = await Product.create({
    name: String(b.name).trim(),
    description: String(b.description || '').trim(),
    price,
    discountPrice: discount,
    category: String(b.category).trim(),
    sizes: b.sizes,
    colors: b.colors,
    images,
    rating: Number(b.rating) || 0,
    stockCount: stock,
  });
  res.status(201).json({ message: `"${product.name}" added to the catalog`, id: product.id });
});

exports.updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByPk(parseInt(req.params.id, 10) || 0);
  if (!product) throw new HttpError(404, 'Product not found');
  const stock = parseInt(req.body.stockCount, 10);
  if (!Number.isInteger(stock) || stock < 0) throw new HttpError(400, 'Stock must be 0 or more');
  await product.update({ stockCount: stock });
  res.json({ message: `Stock for "${product.name}" updated to ${stock}` });
});

exports.deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByPk(parseInt(req.params.id, 10) || 0);
  if (!product) throw new HttpError(404, 'Product not found');
  try {
    await product.destroy();
  } catch (err) {
    if (err.name === 'SequelizeForeignKeyConstraintError') {
      throw new HttpError(409, 'This product has existing orders and cannot be deleted. Set its stock to 0 instead.');
    }
    throw err;
  }
  res.json({ message: `"${product.name}" deleted` });
});

exports.updateOrderStatus = asyncHandler(async (req, res) => {
  const status = String(req.body.status || '');
  if (!ADMIN_STATUSES.includes(status)) throw new HttpError(400, 'Invalid status');
  const order = await Order.findByPk(parseInt(req.params.id, 10) || 0);
  if (!order) throw new HttpError(404, 'Order not found');
  await order.update({ status });
  res.json({ message: `Order #${order.id} marked ${status}`, status });
});
