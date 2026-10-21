const router = require('express').Router();
const auth = require('../middleware/auth');
const allow = require('../middleware/roleCheck');
const c = require('../controllers/classesController');

router.use(auth);
router.get('/', allow('admin', 'accountant'), c.list);
router.post('/', allow('admin'), c.create);
router.delete('/sections/:id', allow('admin'), c.removeSection); // before '/:id'
router.post('/:classId/sections', allow('admin'), c.addSection);
router.put('/:id', allow('admin'), c.update);
router.delete('/:id', allow('admin'), c.remove);

module.exports = router;
