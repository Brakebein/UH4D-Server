const express = require('express');
const router = express.Router();

const image = require('./image');
router.get('/search', image.query);

router.get('/image/dateExtent', image.getDateExtent);
router.get('/image', image.query);
router.get('/image/:id', image.get);
router.put('/image/:id', image.update);
router.put('/image/:id/spatial', image.setSpatial);
router.put('/image/:id/link', image.setLinksToObjects);
router.post('/image/dummy', image.createDummy);
router.delete('/image/dummy/:id', image.deleteDummy);

const imageFileUpdate = require('./imageFileUpdate');
router.get('/image/:id/file/check', imageFileUpdate.check);
router.get('/image/:id/file/update', imageFileUpdate.update);

const digitalobject = require('./digitalobject');
router.get('/model', digitalobject.query);
router.get('/model/:id', digitalobject.get);

const actor = require('./actor');
router.get('/person', actor.queryPersons);
router.get('/legalbody', actor.queryLegalBodies);

const tag = require('./tag');
router.get('/tag', tag.query);

module.exports = router;
