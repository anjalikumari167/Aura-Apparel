// Everything under /admin requires an admin account (mounted at /admin)
const router = require('express').Router();
const { requireAdmin } = require('../middleware/auth');
const admin = require('../controllers/adminController');

router.use(requireAdmin);
router.get('/', admin.dashboard);
router.post('/api/products', admin.createProduct);
router.patch('/api/products/:id', admin.updateProduct);
router.delete('/api/products/:id', admin.deleteProduct);
router.patch('/api/orders/:id/status', admin.updateOrderStatus);

module.exports = router;
