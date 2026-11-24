// =====================================================================
// Database connection (Sequelize). Works with MySQL (default) and PostgreSQL.
// Change DB_DIALECT in .env to switch; all models are dialect-neutral.
// =====================================================================
require('dotenv').config();
const { Sequelize } = require('sequelize');
const mysql2 = require('mysql2');

const dialect = (process.env.DB_DIALECT || 'mysql').toLowerCase();
if (!['mysql', 'postgres'].includes(dialect)) {
  throw new Error(`Unsupported DB_DIALECT "${dialect}". Use "mysql" or "postgres".`);
}

const settings = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || (dialect === 'postgres' ? 5432 : 3306),
  database: process.env.DB_NAME || 'aura_apparel',
  user: process.env.DB_USER || (dialect === 'postgres' ? 'postgres' : 'root'),
  password: process.env.DB_PASSWORD || '',
};

const options = {
  host: settings.host,
  port: settings.port,
  dialect,
    dialectModule: dialect === 'mysql' ? mysql2 : undefined,
      dialectOptions: dialect === 'mysql' && process.env.DB_SSL === 'true'
    ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true } }
    : {},
  logging: process.env.DB_LOGGING === 'true' ? console.log : false,
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
};
if (dialect === 'mysql') options.timezone = '+00:00'; // store all dates in UTC

const sequelize = new Sequelize(settings.database, settings.user, settings.password, options);

    
/** MySQL only: create the database if it doesn't exist yet (saves a manual step). */
async function ensureDatabase() {
  if (dialect !== 'mysql') return; // for PostgreSQL create the DB manually: createdb aura_apparel
  if (!/^[A-Za-z0-9_]+$/.test(settings.database)) {
    throw new Error('DB_NAME may only contain letters, numbers and underscores.');
  }
  const mysql = require('mysql2/promise');
  const conn = await mysql.createConnection({
    host: settings.host,
    port: settings.port,
    user: settings.user,
    password: settings.password,
        ssl: process.env.DB_SSL === 'true' ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
  });
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${settings.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await conn.end();
}

/** Create DB if needed, then verify the connection. Throws a friendly error on failure. */
async function connectDB() {
  try {
    await ensureDatabase();
    await sequelize.authenticate();
    console.log(`✔ Database connected (${dialect} @ ${settings.host}:${settings.port}/${settings.database})`);
  } catch (err) {
    console.error('✘ Could not connect to the database.');
    console.error('  Check that MySQL is running and DB_HOST / DB_USER / DB_PASSWORD in .env are correct.');
    console.error('  Original error:', err.message);
    throw err;
  }
}

module.exports = { sequelize, connectDB, ensureDatabase, dialect, settings };
