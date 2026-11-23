const { User, CartItem } = require('../models');
const { wantsJson } = require('../utils/helpers');

/** Runs on every request: loads the logged-in user (if any) and the cart badge count. */
async function loadUser(req, res, next) {
  req.user = null;
  res.locals.currentUser = null;
  res.locals.cartCount = 0;
  try {
    if (req.session.userId) {
      const user = await User.findByPk(req.session.userId);
      if (user) {
        req.user = user;
        res.locals.currentUser = user.toSafeJSON();
      } else {
        delete req.session.userId; // account was deleted
      }
    }
    if (!req.originalUrl.startsWith('/api/')) {
      if (req.user) {
        res.locals.cartCount = Number(await CartItem.sum('quantity', { where: { userId: req.user.id } })) || 0;
      } else {
        res.locals.cartCount = (req.session.cart || []).reduce((s, i) => s + i.quantity, 0);
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

function requireLogin(req, res, next) {
  if (req.user) return next();
  if (wantsJson(req)) return res.status(401).json({ error: 'Please log in to continue', login: true });
  return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
}

function requireAdmin(req, res, next) {
  if (!req.user) return requireLogin(req, res, next);
  if (req.user.role === 'admin') return next();
  if (wantsJson(req)) return res.status(403).json({ error: 'Admin access required' });
  return res.status(403).render('pages/error', {
    title: 'Access denied',
    status: 403,
    message: 'You do not have permission to view this page.',
  });
}

function redirectIfLoggedIn(req, res, next) {
  if (req.user) return res.redirect('/');
  next();
}

module.exports = { loadUser, requireLogin, requireAdmin, redirectIfLoggedIn };
