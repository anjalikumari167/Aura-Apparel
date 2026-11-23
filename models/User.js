const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');
const { jsonColumn } = require('./helpers');

const User = sequelize.define(
  'User',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: { notEmpty: { msg: 'Name is required' } },
    },
    email: {
      type: DataTypes.STRING(190),
      allowNull: false,
      unique: { name: 'users_email_unique', msg: 'An account with this email already exists' },
      validate: { isEmail: { msg: 'Please enter a valid email address' } },
      set(v) {
        this.setDataValue('email', String(v || '').trim().toLowerCase());
      },
    },
    // Only the bcrypt hash is stored. Plain passwords never touch the database.
    passwordHash: { type: DataTypes.STRING(100), allowNull: false },
    // Write-only virtual field: User.create({ ..., password: 'secret1' }) hashes automatically.
    password: {
      type: DataTypes.VIRTUAL,
      set(plain) {
        if (typeof plain !== 'string' || plain.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }
        this.setDataValue('password', plain);
        this.setDataValue('passwordHash', bcrypt.hashSync(plain, 10));
      },
      get() {
        return undefined;
      },
    },
    phone: { type: DataTypes.STRING(30), allowNull: true },
    // Saved address: { name, phone, line1, line2, city, state, postalCode, country }
    defaultAddress: jsonColumn('defaultAddress', { allowNull: true }),
    role: { type: DataTypes.ENUM('customer', 'admin'), allowNull: false, defaultValue: 'customer' },
  },
  { tableName: 'users', timestamps: true }
);

User.prototype.checkPassword = function checkPassword(plain) {
  return bcrypt.compareSync(String(plain || ''), this.passwordHash);
};

User.prototype.isAdmin = function isAdmin() {
  return this.role === 'admin';
};

/** Data that is safe to put in a session or send to the browser (no hash). */
User.prototype.toSafeJSON = function toSafeJSON() {
  return {
    id: this.id,
    name: this.name,
    email: this.email,
    phone: this.phone,
    role: this.role,
    defaultAddress: this.defaultAddress,
  };
};

module.exports = User;
