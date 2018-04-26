const utils = require('../modules/utils');
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

const author = require('./author');
router.get('/author', author.query);

const tag = require('./tag');
router.get('/tag', tag.query);

module.exports = router;
