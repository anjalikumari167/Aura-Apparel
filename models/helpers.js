// =====================================================================
// Column helpers that keep the models portable across MySQL, MariaDB
// (XAMPP) and PostgreSQL. We deliberately avoid native JSON / ARRAY
// column types, because they behave differently on each database.
// =====================================================================
const { DataTypes } = require('sequelize');

/** DECIMAL column that always comes back as a JS number (MySQL returns decimals as strings). */
function moneyColumn(field, { allowNull = false, defaultValue } = {}) {
  const col = {
    type: DataTypes.DECIMAL(10, 2),
    allowNull,
    get() {
      const v = this.getDataValue(field);
      return v === null || v === undefined ? null : Number(v);
    },
  };
  if (defaultValue !== undefined) col.defaultValue = defaultValue;
  return col;
}

/** Object/array stored as JSON text. Reads parse automatically, writes stringify automatically. */
function jsonColumn(field, { allowNull = true, fallback = null } = {}) {
  const col = {
    type: DataTypes.TEXT,
    allowNull,
    get() {
      const raw = this.getDataValue(field);
      if (raw === null || raw === undefined || raw === '') return fallback;
      try {
        return JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(val) {
      this.setDataValue(field, val === null || val === undefined ? null : JSON.stringify(val));
    },
  };
  if (fallback !== null) col.defaultValue = JSON.stringify(fallback);
  return col;
}

/**
 * List of short strings stored as ",S,M,L," so we can filter in plain SQL with
 *   WHERE sizes LIKE '%,M,%'
 * on any database. Accepts an array OR a comma-separated string (handy for admin forms).
 */
function listColumn(field) {
  const toList = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: '',
    get() {
      return toList(this.getDataValue(field));
    },
    set(val) {
      const items = Array.isArray(val) ? val : toList(val);
      const clean = [...new Set(items.map((s) => String(s).replace(/,/g, ' ').trim()).filter(Boolean))];
      this.setDataValue(field, clean.length ? `,${clean.join(',')},` : '');
    },
  };
}

module.exports = { moneyColumn, jsonColumn, listColumn };
