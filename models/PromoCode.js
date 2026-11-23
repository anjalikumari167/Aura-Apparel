const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PromoCode = sequelize.define(
  'PromoCode',
  {
    code: {
      type: DataTypes.STRING(40),
      primaryKey: true,
      allowNull: false,
      set(v) {
        this.setDataValue('code', String(v || '').trim().toUpperCase());
      },
    },
    discountPercent: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 100 } },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { tableName: 'promo_codes', timestamps: false }
);

/** Returns the promo row if the code exists AND is active, otherwise null. */
PromoCode.findActive = function findActive(code, options = {}) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) return Promise.resolve(null);
  return PromoCode.findOne({ where: { code: normalized, isActive: true }, ...options });
};

module.exports = PromoCode;
