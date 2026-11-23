const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { moneyColumn, jsonColumn } = require('./helpers');

const STATUSES = ['Processing', 'Shipped', 'Delivered', 'Cancelled'];

const Order = sequelize.define(
  'Order',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    // userId (FK -> users.id) is added by the association in models/index.js
    totalAmount: moneyColumn('totalAmount', { defaultValue: 0 }),
    discountApplied: moneyColumn('discountApplied', { defaultValue: 0 }),
    promoCode: { type: DataTypes.STRING(40), allowNull: true },
    // { name, phone, line1, line2, city, state, postalCode, country }
    shippingAddress: jsonColumn('shippingAddress', { allowNull: false }),
    status: { type: DataTypes.ENUM(...STATUSES), allowNull: false, defaultValue: 'Processing' },
    paymentMethod: { type: DataTypes.STRING(60), allowNull: false, defaultValue: 'Card (Simulated)' },
  },
  { tableName: 'orders', timestamps: true, indexes: [{ fields: ['userId', 'createdAt'] }, { fields: ['status'] }] }
);

Order.STATUSES = STATUSES;

module.exports = Order;
