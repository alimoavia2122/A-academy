const router = require('express').Router();
const auth = require('../middleware/auth');
const allow = require('../middleware/roleCheck');
const c = require('../controllers/reportsController');

router.use(auth, allow('admin', 'accountant'));
router.get('/defaulters', c.defaulters);
router.get('/daily', c.daily);
router.get('/monthly', c.monthly);

module.exports = router;
