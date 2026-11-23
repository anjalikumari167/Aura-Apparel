const { User } = require('../models');
const cartService = require('../utils/cartService');
const { asyncHandler, safeRedirect } = require('../utils/helpers');
const { isEmail } = require('../utils/validators');

/** Fresh session id (prevents session fixation) + keep the guest cart + merge it into the DB cart. */
async function startSession(req, user) {
  const guestCart = req.session.cart || [];
  const promoCode = req.session.promoCode;
  await new Promise((resolve, reject) => req.session.regenerate((e) => (e ? reject(e) : resolve())));
  req.session.userId = user.id;
  if (promoCode) req.session.promoCode = promoCode;
  if (guestCart.length) await cartService.mergeGuestCart(guestCart, user.id);
  await new Promise((resolve, reject) => req.session.save((e) => (e ? reject(e) : resolve())));
}

exports.loginPage = (req, res) => {
  res.render('pages/login', { title: 'Log in', error: null, email: '', next: safeRedirect(req.query.next, '') });
};

exports.signupPage = (req, res) => {
  res.render('pages/signup', { title: 'Create account', error: null, form: {}, next: safeRedirect(req.query.next, '') });
};

exports.login = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const next = safeRedirect(req.body.next, '');
  const user = email ? await User.findOne({ where: { email } }) : null;

  if (!user || !user.checkPassword(req.body.password)) {
    return res.status(401).render('pages/login', { title: 'Log in', error: 'Invalid email or password', email, next });
  }
  await startSession(req, user);
  res.redirect(user.isAdmin() && !next ? '/admin' : next || '/');
});

exports.signup = asyncHandler(async (req, res) => {
  const form = {
    name: String(req.body.name || '').trim(),
    email: String(req.body.email || '').trim().toLowerCase(),
  };
  const next = safeRedirect(req.body.next, '');
  const fail = (error) => res.status(400).render('pages/signup', { title: 'Create account', error, form, next });

  if (!form.name) return fail('Please enter your name');
  if (!isEmail(form.email)) return fail('Please enter a valid email address');
  if (String(req.body.password || '').length < 6) return fail('Password must be at least 6 characters');
  if (req.body.password !== req.body.confirm) return fail('Passwords do not match');

  let user;
  try {
    user = await User.create({ name: form.name, email: form.email, password: req.body.password });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') return fail('An account with this email already exists');
    throw err;
  }
  await startSession(req, user);
  res.redirect(next || '/');
});

exports.logout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
};
