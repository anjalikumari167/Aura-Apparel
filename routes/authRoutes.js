const router = require('express').Router();
const auth = require('../controllers/authController');
const { redirectIfLoggedIn } = require('../middleware/auth');

router.get('/login', redirectIfLoggedIn, auth.loginPage);
router.post('/login', redirectIfLoggedIn, auth.login);
router.get('/signup', redirectIfLoggedIn, auth.signupPage);
router.post('/signup', redirectIfLoggedIn, auth.signup);
router.post('/logout', auth.logout);

module.exports = router;
