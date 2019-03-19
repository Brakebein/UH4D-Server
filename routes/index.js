const config = require('../config'),
	express = require('express'),
	router = express.Router(),
	shortid = require('shortid'),
	utils = require('../modules/utils');


// multer
const multer = require('multer'),
	storage = multer.diskStorage({
		destination: function (req, file, cb) {
			cb(null, config.path.tmp);
		},
		filename: function (req, file, cb) {
			if (req.body.tid)
				cb(null, req.body.tid + '_' + utils.replace(file.orignalname));
			else
				cb(null, file.fieldname + '-' + shortid.generate());
		}
	});
const mUpload = multer({ storage: storage });

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
router.put('/model/:id', digitalobject.update);

router.post('/model/upload', mUpload.single('uploadModelFile'), require('./upload'));
router.post('/model', digitalobject.save);
router.post('/model/temp', digitalobject.deleteTemp);

const actor = require('./actor');
router.get('/person', actor.queryPersons);
router.get('/legalbody', actor.queryLegalBodies);

const tag = require('./tag');
router.get('/tag', tag.query);

module.exports = router;
