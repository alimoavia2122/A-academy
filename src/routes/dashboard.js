const router = require('express').Router();
const auth = require('../middleware/auth');
const allow = require('../middleware/roleCheck');
const c = require('../controllers/dashboardController');

router.get('/', auth, allow('admin', 'accountant'), c.summary);

module.exports = router;
