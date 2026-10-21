const router = require('express').Router();
const auth = require('../middleware/auth');
const allow = require('../middleware/roleCheck');
const c = require('../controllers/studentsController');

router.use(auth);
router.get('/', allow('admin', 'accountant'), c.list);
router.get('/:id', allow('admin', 'accountant'), c.get);
router.post('/', allow('admin'), c.create);
router.put('/:id', allow('admin'), c.update);
router.patch('/:id/status', allow('admin'), c.setStatus);

module.exports = router;
