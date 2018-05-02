const express = require('express');
const router = express.Router();

const image = require('./image');
router.get('/search', image.query);

router.get('/image', image.query);
router.get('/image/:id', image.get);
router.put('/image/:id', image.update);
router.put('/image/:id/spatial', image.setSpatial);

const digitalobject = require('./digitalobject');
router.get('/model', digitalobject.query);

const actor = require('./actor');
router.get('/person', actor.queryPersons);
router.get('/legalbody', actor.queryLegalBodies);

const tag = require('./tag');
router.get('/tag', tag.query);

module.exports = router;
