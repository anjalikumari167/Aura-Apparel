const { Op } = require('sequelize');
const { Product, WishlistItem } = require('../models');
const { asyncHandler, asArray } = require('../utils/helpers');

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

async function wishlistIdsFor(req) {
  if (!req.user) return [];
  const rows = await WishlistItem.findAll({ where: { userId: req.user.id }, attributes: ['productId'] });
  return rows.map((r) => r.productId);
}

async function getFilterOptions() {
  const rows = await Product.findAll({ attributes: ['category', 'sizes', 'colors', 'effectivePrice'] });
  const sizes = [...new Set(rows.flatMap((r) => r.sizes))].sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a);
    const ib = SIZE_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b, undefined, { numeric: true });
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  const prices = rows.map((r) => r.effectivePrice);
  return {
    categories: [...new Set(rows.map((r) => r.category))].sort(),
    sizes,
    colors: [...new Set(rows.flatMap((r) => r.colors))].sort(),
    minPrice: prices.length ? Math.floor(Math.min(...prices)) : 0,
    maxPrice: prices.length ? Math.ceil(Math.max(...prices)) : 0,
  };
}

exports.home = asyncHandler(async (req, res) => {
  const [newest, sale, all, wishlistIds] = await Promise.all([
    Product.findAll({ order: [['createdAt', 'DESC'], ['id', 'DESC']], limit: 8 }),
    Product.findAll({ where: { discountPrice: { [Op.ne]: null } }, order: [['createdAt', 'DESC']], limit: 4 }),
    Product.findAll({ attributes: ['category', 'images'], order: [['id', 'ASC']] }),
    wishlistIdsFor(req),
  ]);
  const seen = new Map();
  all.forEach((p) => {
    if (!seen.has(p.category)) seen.set(p.category, p.images[0] || '');
  });
  const categories = [...seen.entries()].map(([name, image]) => ({ name, image }));
  res.render('pages/home', { title: 'Modern essentials', newest, sale, categories, wishlistIds });
});

exports.shop = asyncHandler(async (req, res) => {
  const { where, order } = Product.buildQuery(req.query);
  const [products, options, wishlistIds] = await Promise.all([
    Product.findAll({ where, order }),
    getFilterOptions(),
    wishlistIdsFor(req),
  ]);
  const selected = {
    search: String(req.query.search || ''),
    categories: asArray(req.query.categories),
    sizes: asArray(req.query.sizes),
    colors: asArray(req.query.colors),
    minPrice: req.query.minPrice || '',
    maxPrice: req.query.maxPrice || '',
    sort: req.query.sort || 'newest',
  };
  res.render('pages/shop', { title: 'Shop', products, options, selected, wishlistIds });
});

/** HTML fragment used by the live filter (fetch -> replace the grid, no page reload). */
exports.shopGrid = asyncHandler(async (req, res) => {
  const { where, order } = Product.buildQuery(req.query);
  const [products, wishlistIds] = await Promise.all([Product.findAll({ where, order }), wishlistIdsFor(req)]);
  res.render('partials/product-grid', { products, wishlistIds });
});

exports.product = asyncHandler(async (req, res, next) => {
  const product = await Product.findByPk(parseInt(req.params.id, 10) || 0);
  if (!product) return next(); // -> 404 page
  const [related, wishlistIds] = await Promise.all([
    Product.findAll({
      where: { category: product.category, id: { [Op.ne]: product.id } },
      order: [['rating', 'DESC']],
      limit: 4,
    }),
    wishlistIdsFor(req),
  ]);
  res.render('pages/product', {
    title: product.name,
    product,
    related,
    wishlistIds,
    wishlisted: wishlistIds.includes(product.id),
  });
});

exports.wishlistIdsFor = wishlistIdsFor;
