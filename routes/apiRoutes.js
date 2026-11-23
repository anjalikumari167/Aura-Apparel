// JSON endpoints used by public/js/*.js (mounted at /api)
const router = require('express').Router();
const { requireLogin } = require('../middleware/auth');
const cart = require('../controllers/cartController');
const checkout = require('../controllers/checkoutController');
const account = require('../controllers/accountController');

// Cart + promo: work for guests AND logged-in users
router.get('/cart', cart.getCart);
router.post('/cart/add', cart.add);
router.post('/cart/update', cart.update);
router.post('/cart/remove', cart.remove);
router.post('/cart/promo', cart.applyPromo);
router.post('/cart/promo/remove', cart.removePromo);

// Need an account
router.post('/wishlist/toggle', requireLogin, cart.toggleWishlist);
router.post('/checkout', requireLogin, checkout.placeOrder);
router.post('/account', requireLogin, account.updateAccount);

module.exports = router;
