const router = require('express').Router();
const auth = require('../middleware/auth');
const allow = require('../middleware/roleCheck');
const c = require('../controllers/paymentsController');

router.use(auth, allow('admin', 'accountant'));
router.get('/search', c.search);
router.get('/by-challan/:id', c.byChallan);
router.get('/:id', c.get);
router.post('/', c.record);

module.exports = router;
