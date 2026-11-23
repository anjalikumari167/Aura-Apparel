const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WishlistItem = sequelize.define(
  'WishlistItem',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    // userId and productId (FKs) come from the associations in models/index.js
  },
  {
    tableName: 'wishlist_items',
    timestamps: true,
    updatedAt: false,
    indexes: [{ unique: true, name: 'wishlist_unique', fields: ['userId', 'productId'] }],
  }
);

module.exports = WishlistItem;
