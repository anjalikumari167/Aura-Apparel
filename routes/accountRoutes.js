// Pages that need a logged-in user.
// NOTE: requireLogin is attached per route (not router.use) so it never blocks other routers
// mounted later (guest cart API, admin, 404 page).
const router = require('express').Router();
const { requireLogin } = require('../middleware/auth');
const account = require('../controllers/accountController');
const checkout = require('../controllers/checkoutController');

router.get('/checkout', requireLogin, checkout.checkoutPage);
router.get('/orders', requireLogin, account.orders);
router.get('/orders/:id/confirmation', requireLogin, account.confirmation);
router.get('/wishlist', requireLogin, account.wishlist);
router.get('/account', requireLogin, account.accountPage);

module.exports = router;
