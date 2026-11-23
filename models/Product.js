const { DataTypes, Op } = require('sequelize');
const { sequelize, dialect } = require('../config/database');
const { moneyColumn, jsonColumn, listColumn } = require('./helpers');

const Product = sequelize.define(
  'Product',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(150), allowNull: false, validate: { notEmpty: { msg: 'Product name is required' } } },
    description: { type: DataTypes.TEXT, allowNull: true },
    price: moneyColumn('price'),
    discountPrice: moneyColumn('discountPrice', { allowNull: true }),
    // Stored copy of COALESCE(discountPrice, price). Kept in sync by the hook below,
    // so price filters and "Price Low-High" sorting are simple, correct SQL.
    effectivePrice: moneyColumn('effectivePrice'),
    category: { type: DataTypes.STRING(60), allowNull: false, validate: { notEmpty: true } },
    sizes: listColumn('sizes'),
    colors: listColumn('colors'),
    images: jsonColumn('images', { allowNull: false, fallback: [] }),
    rating: {
      type: DataTypes.DECIMAL(2, 1),
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0, max: 5 },
      get() {
        return Number(this.getDataValue('rating'));
      },
    },
    stockCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: { args: [0], msg: 'Stock cannot be negative' } },
    },
    // 'in' | 'low' | 'out' (not stored, computed from stockCount)
    stockStatus: {
      type: DataTypes.VIRTUAL,
      get() {
        const n = this.getDataValue('stockCount');
        return n <= 0 ? 'out' : n <= 5 ? 'low' : 'in';
      },
    },
  },
  {
    tableName: 'products',
    timestamps: true,
    indexes: [{ fields: ['category'] }, { fields: ['effectivePrice'] }, { fields: ['createdAt'] }],
    validate: {
      discountBelowPrice() {
        const p = this.getDataValue('price');
        const d = this.getDataValue('discountPrice');
        if (d !== null && d !== undefined && Number(d) >= Number(p)) {
          throw new Error('Discount price must be lower than the regular price');
        }
      },
    },
    hooks: {
      // Runs on create() and instance.save()/update(). Note: bulk Model.update() skips hooks.
      beforeValidate(product) {
        const price = product.getDataValue('price');
        const disc = product.getDataValue('discountPrice');
        if (price !== null && price !== undefined) {
          product.setDataValue('effectivePrice', disc !== null && disc !== undefined && disc !== '' ? disc : price);
        }
      },
    },
  }
);

// ---------------------------------------------------------------------
// Live catalog query builder: turns the storefront's filter UI into SQL.
//   const { where, order } = Product.buildQuery(req.query);
//   const products = await Product.findAll({ where, order });
// Accepts: search, categories, sizes, colors, minPrice, maxPrice, sort
// ---------------------------------------------------------------------
const likeOp = dialect === 'postgres' ? Op.iLike : Op.like; // MySQL LIKE is already case-insensitive
const escapeLike = (s) => String(s).replace(/[\\%_]/g, '\\$&');
const toArr = (v) =>
  []
    .concat(v === undefined || v === null ? [] : v)
    .flatMap((x) => String(x).split(','))
    .map((s) => s.trim())
    .filter(Boolean);

const SORTS = {
  newest: [['createdAt', 'DESC'], ['id', 'DESC']],
  price_asc: [['effectivePrice', 'ASC'], ['id', 'ASC']],
  price_desc: [['effectivePrice', 'DESC'], ['id', 'ASC']],
  rating: [['rating', 'DESC'], ['createdAt', 'DESC']],
};

Product.buildQuery = function buildQuery(f = {}) {
  const and = [];

  const term = String(f.search || '').trim();
  if (term) {
    const like = `%${escapeLike(term)}%`;
    and.push({
      [Op.or]: [
        { name: { [likeOp]: like } },
        { description: { [likeOp]: like } },
        { category: { [likeOp]: like } },
      ],
    });
  }

  const categories = toArr(f.categories ?? f.category);
  if (categories.length) and.push({ category: { [Op.in]: categories } });

  const sizes = toArr(f.sizes ?? f.size);
  if (sizes.length) and.push({ [Op.or]: sizes.map((s) => ({ sizes: { [Op.like]: `%,${escapeLike(s)},%` } })) });

  const colors = toArr(f.colors ?? f.color);
  if (colors.length) and.push({ [Op.or]: colors.map((c) => ({ colors: { [likeOp]: `%,${escapeLike(c)},%` } })) });

  const min = f.minPrice !== undefined && f.minPrice !== '' ? Number(f.minPrice) : null;
  const max = f.maxPrice !== undefined && f.maxPrice !== '' ? Number(f.maxPrice) : null;
  if (min !== null && !Number.isNaN(min)) and.push({ effectivePrice: { [Op.gte]: min } });
  if (max !== null && !Number.isNaN(max)) and.push({ effectivePrice: { [Op.lte]: max } });

  return {
    where: and.length ? { [Op.and]: and } : {},
    order: SORTS[f.sort] || SORTS.newest,
  };
};

module.exports = Product;
