// =====================================================================
// Model registry + ASSOCIATIONS (foreign keys).
// Always import models from here:  const { User, Product } = require('./models');
//
//  users 1───* orders 1───* order_items *───1 products
//  users 1───* cart_items *───1 products
//  users 1───* wishlist_items *───1 products
//  promo_codes (standalone lookup table)
// =====================================================================
const { sequelize } = require('../config/database');

const User = require('./User');
const Product = require('./Product');
const Order = require('./Order');
const OrderItem = require('./OrderItem');
const PromoCode = require('./PromoCode');
const CartItem = require('./CartItem');
const WishlistItem = require('./WishlistItem');

// NOT NULL foreign key helper
const fk = (name) => ({ name, allowNull: false });

// ----- User <-> Order  (RESTRICT: you can't delete a user who has orders)
User.hasMany(Order, { foreignKey: fk('userId'), as: 'orders', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
Order.belongsTo(User, { foreignKey: fk('userId'), as: 'customer' });

// ----- Order <-> OrderItem  (CASCADE: deleting an order removes its lines)
Order.hasMany(OrderItem, { foreignKey: fk('orderId'), as: 'items', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
OrderItem.belongsTo(Order, { foreignKey: fk('orderId'), as: 'order' });

// ----- Product <-> OrderItem  (RESTRICT: a product that was ordered can't be deleted)
Product.hasMany(OrderItem, { foreignKey: fk('productId'), as: 'orderItems', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
OrderItem.belongsTo(Product, { foreignKey: fk('productId'), as: 'product' });

// ----- Cart (CASCADE on both sides)
User.hasMany(CartItem, { foreignKey: fk('userId'), as: 'cartItems', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
CartItem.belongsTo(User, { foreignKey: fk('userId'), as: 'user' });
Product.hasMany(CartItem, { foreignKey: fk('productId'), as: 'cartItems', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
CartItem.belongsTo(Product, { foreignKey: fk('productId'), as: 'product' });

// ----- Wishlist (CASCADE on both sides)
User.hasMany(WishlistItem, { foreignKey: fk('userId'), as: 'wishlistItems', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
WishlistItem.belongsTo(User, { foreignKey: fk('userId'), as: 'user' });
Product.hasMany(WishlistItem, { foreignKey: fk('productId'), as: 'wishlistItems', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
WishlistItem.belongsTo(Product, { foreignKey: fk('productId'), as: 'product' });

module.exports = { sequelize, User, Product, Order, OrderItem, PromoCode, CartItem, WishlistItem };
