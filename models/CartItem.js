const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Persistent cart for LOGGED-IN users. Guest carts live in the session (SQL session store)
// and are merged into this table at login.
const CartItem = sequelize.define(
  'CartItem',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    // userId and productId (FKs) come from the associations in models/index.js
    size: { type: DataTypes.STRING(30), allowNull: false, defaultValue: '' },
    color: { type: DataTypes.STRING(40), allowNull: false, defaultValue: '' },
    quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, validate: { min: 1 } },
  },
  {
    tableName: 'cart_items',
    timestamps: true,
    indexes: [{ unique: true, name: 'cart_unique_line', fields: ['userId', 'productId', 'size', 'color'] }],
  }
);

module.exports = CartItem;
