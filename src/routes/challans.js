const router = require('express').Router();
const auth = require('../middleware/auth');
const allow = require('../middleware/roleCheck');
const c = require('../controllers/challansController');

router.use(auth, allow('admin', 'accountant'));
router.get('/', c.list);
router.get('/print-data', c.printData);
router.post('/generate', c.generate);

module.exports = router;
