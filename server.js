// =====================================================================
// AURA APPAREL — Express server
//   npm run dev   (auto-restart)      npm start
// =====================================================================
require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const morgan = require('morgan');

const { sequelize, connectDB } = require('./config/database');
require('./models'); // registers models + associations
const { loadUser } = require('./middleware/auth');
const { makeMoney, wantsJson, STATUS_CLASS } = require('./utils/helpers');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.startsWith('change-this')) {
  console.warn('⚠  SESSION_SECRET is not set to a private value. Edit .env before deploying.');
}

// ---------- view engine ----------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ---------- middleware ----------
if (!isProd) app.use(morgan('dev'));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Sessions are stored in the SQL database (table: sessions) through the same Sequelize connection.
const sessionStore = new SequelizeStore({
  db: sequelize,
  tableName: 'sessions',
  checkExpirationInterval: 15 * 60 * 1000,
  expiration: 7 * 24 * 60 * 60 * 1000,
});
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-only-secret',
    store: sessionStore,
    resave: false,
    saveUninitialized: false, // a guest only gets a session once they add something to the cart
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === 'true', // set true when serving over HTTPS
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use(loadUser);

// Helpers available inside every EJS template
const money = makeMoney();
app.use((req, res, next) => {
  res.locals.money = money;
  res.locals.statusClass = STATUS_CLASS;
  res.locals.currency = process.env.CURRENCY || 'USD';
  res.locals.locale = process.env.LOCALE || 'en-US';
  res.locals.fmtDate = (d) =>
    new Date(d).toLocaleString(res.locals.locale, { dateStyle: 'medium', timeStyle: 'short' });
  res.locals.path = req.path;
  next();
});

// ---------- routes ----------
app.use('/', require('./routes/storeRoutes'));
app.use('/', require('./routes/authRoutes'));
app.use('/', require('./routes/accountRoutes'));
app.use('/api', require('./routes/apiRoutes'));
app.use('/admin', require('./routes/adminRoutes'));

// ---------- 404 + errors ----------
app.use((req, res) => {
  if (wantsJson(req)) return res.status(404).json({ error: 'Not found' });
  res.status(404).render('pages/error', {
    title: 'Page not found',
    status: 404,
    message: "The page you're looking for doesn't exist.",
  });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong';

  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    status = 400;
    message = err.errors.map((e) => e.message).join(', ');
  } else if (status >= 500) {
    console.error(err); // full details only in the terminal
    if (isProd) message = 'Something went wrong. Please try again.';
  }

  if (wantsJson(req)) return res.status(status).json({ error: message });
  res.status(status).render('pages/error', { title: 'Error', status, message });
});

// ---------- start ----------
(async () => {
  try {
    await connectDB();
    // Create any missing tables (never drops data). `npm run seed` is what resets everything.
    await sequelize.sync();
    await sessionStore.sync();
    app.listen(PORT, () => console.log(`✔ AURA APPAREL running at http://localhost:${PORT}`));
  } catch (err) {
    console.error('✘ Server failed to start:', err.message);
    process.exit(1);
  }
})();
