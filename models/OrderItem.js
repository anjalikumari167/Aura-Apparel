const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { moneyColumn } = require('./helpers');

const OrderItem = sequelize.define(
  'OrderItem',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    // orderId (FK -> orders.id) and productId (FK -> products.id) come from the associations
    productName: { type: DataTypes.STRING(150), allowNull: false }, // snapshot, survives later product edits
    size: { type: DataTypes.STRING(30), allowNull: false, defaultValue: '' },
    color: { type: DataTypes.STRING(40), allowNull: false, defaultValue: '' },
    quantity: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1 } },
    priceAtPurchase: moneyColumn('priceAtPurchase'),
    lineTotal: {
      type: DataTypes.VIRTUAL,
      get() {
        return Math.round(Number(this.getDataValue('priceAtPurchase')) * this.getDataValue('quantity') * 100) / 100;
      },
    },
  },
  { tableName: 'order_items', timestamps: false, indexes: [{ fields: ['orderId'] }] }
);

module.exports = OrderItem;
