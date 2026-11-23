const router = require('express').Router();
const store = require('../controllers/storeController');

router.get('/', store.home);
router.get('/shop', store.shop);
router.get('/shop/grid', store.shopGrid); // HTML fragment for the live filter
router.get('/product/:id', store.product);

module.exports = router;
