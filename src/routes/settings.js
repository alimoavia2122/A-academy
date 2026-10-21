const router = require('express').Router();
const auth = require('../middleware/auth');
const allow = require('../middleware/roleCheck');
const c = require('../controllers/settingsController');

router.use(auth);
router.get('/', allow('admin', 'accountant'), c.get);
router.put('/', allow('admin'), c.update);

module.exports = router;
