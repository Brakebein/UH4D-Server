const utils = require('../modules/utils');
const express = require('express');
const router = express.Router();

const image = require('./image');
router.get('/search', image.query);

router.get('/image', image.query);
router.get('/image/:id', image.get);
router.put('/image/:id/spatial', image.setSpatial);

const digitalobject = require('./digitalobject');
router.get('/model', digitalobject.query);

module.exports = router;
