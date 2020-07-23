const config = require('../config');
const utils = require('../modules/utils');
const Promise = require('bluebird');
const request = require('request-promise');
const fs = require('fs-extra-promise');
const execFile = require('child-process-promise').execFile;
const uuid = require('uuid/v4');
const requestImageSize = require('request-image-size');
const neo4j = require('neo4j-request');


function getFileMetaData(id) {

	const q = `MATCH (image:E38:UH4D {id: $id})-[:P106]->(file:D9),
			(image)-[:P48]->(identifier:E42)
		RETURN file, identifier`;

	return neo4j.readTransaction(q, { id: id })
		.then(function (results) {
			return results[0];
		});
}

function retrieveImageUrl(permalink) {
	const options = {
		uri: permalink,
		proxy: config.proxy
	};

	return request(options)
		.then(function (htmlString) {
			const pattern = /<a class="download"[^<>]*href="([^"]*)"/;
			const matches = pattern.exec(htmlString);

			return matches ? matches[1] : null;
		});
}

function downloadImage(uri, filename) {
	const request = require('request');
	const fs = require('fs');

	return new Promise(function (resolve, reject) {
		request({
			uri: uri,
			proxy: config.proxy
		}).pipe(fs.createWriteStream(filename))
			.on('close', function () {
				resolve();
			})
			.on('error', function (err) {
				reject(err);
			});
	});
}

module.exports = {

	check: function (req, res) {

		let file, permalink, imageUrl;

		// get file metadata from database
		getFileMetaData(req.params.id)
			.catch(function (err) {
				utils.error.neo4j(res, err, 'imageFileUpdate.check');
				return Promise.reject();
			})
			.then(function (obj) {
				file = obj.file;
				permalink = obj.identifier.permalink;

				// parse image url from DFD site
				return retrieveImageUrl(permalink);
			})
			.then(function (link) {
				if (!link)
					return Promise.resolve('No link available');

				console.log(link);
				imageUrl = link;

				// get image size of image online
				return requestImageSize({
					url: imageUrl,
					proxy: config.proxy
				});
			})
			.then(function (data) {
				if (typeof data === 'string')
					data = { message: data };
				else {
					data.updateAvailable = data.width > file.width || data.height > file.height;
					data.url = imageUrl;
				}

				res.json(data);
			})
			.catch(function (err) {
				if (err) utils.error.general(res, err);
			});

	},

	update: function (req, res) {

		const rootPath = config.path.data + '/';
		let permalink, imageUrl;
		let oldFile, newFile;

		// get file metadata from database
		getFileMetaData(req.params.id)
			.catch(function (err) {
				utils.error.neo4j(res, err, 'imageFileUpdate.update getFileMetaData');
				return Promise.reject();
			})
			.then(function (obj) {
				oldFile = obj.file;
				permalink = obj.identifier.permalink;

				// parse image url from DFD site
				return retrieveImageUrl(permalink);
			})
			.then(function (link) {
				imageUrl = link;
				console.log('Image link:', link);

				// get image size of image online
				return requestImageSize({
					url: imageUrl,
					proxy: config.proxy
				});
			})
			.then(function (size) {
				const filename = utils.replace(imageUrl.split('/').pop());
				newFile = {
					id: oldFile.id,
					path: 'images/' + uuid() + '/',
					original: filename,
					thumb: filename.slice(0, filename.lastIndexOf('.')) + '_thumb.jpg',
					preview: filename.slice(0, filename.lastIndexOf('.')) + '_preview.jpg',
					width: size.width,
					height: size.height,
					type: size.type
				};

				return Promise.resolve();
			})
			.catch(function (err) {
				if (err) utils.error.general(res, err);
				return Promise.reject();
			})

			.then(function () {
				// create new directory
				return fs.ensureDirAsync(rootPath + newFile.path);
			})
			.then(function () {
				// download image
				return downloadImage(imageUrl, rootPath + newFile.path + newFile.original);
			})
			.catch(function (err) {
				if (err) utils.error.server(res, err, 'fs.ensureDir || request || writeStream');
				return Promise.reject();
			})

			.then(function () {
				// create thumbnail
				return execFile(config.exec.ImagickConvert, [rootPath + newFile.path + newFile.original, '-resize', '200x200>', rootPath + newFile.path + newFile.thumb]);
			})
			.then(function () {
				// create preview image
				return execFile(config.exec.ImagickConvert, [rootPath + newFile.path + newFile.original, '-resize', '2048x2048>', rootPath + newFile.path + newFile.preview]);
			})
			.catch(function (err) {
				if (err) utils.error.server(res, err, 'execFile ImagickConvert');
				return Promise.reject();
			})

			.then(function () {
				// update database entry
				const q = `MATCH (image:E38:UH4D {id: $id})-[:P106]->(file:D9)
					SET file = $file
					RETURN file`;

				return neo4j.writeTransaction(q, { id: req.params.id, file: newFile });
			})
			.catch(function (err) {
				if (err) utils.error.neo4j(res, err, 'imageFileUpdate.update set file');
				return Promise.reject('unlink');
			})

			.then(function () {
				// remove old directory
				fs.removeAsync(rootPath + oldFile.path)
					.then(function () {
						console.warn('Unlink old directory:', oldFile.path);
					});

				// response
				res.json(newFile);
			})

			.catch(function (reason) {
				if (reason === 'unlink' && newFile && newFile.path)
					// something went wrong -> delete new directory
					fs.existsAsync(rootPath + newFile.path)
						.then(function (exists) {
							if (exists) {
								console.warn('Something went wrong! Unlink new directory:', newFile.path);
								fs.removeAsync(rootPath + newFile.path);
							}
						});
				else
					console.warn('Something went wrong! Nothing to clean up.');
			});

	}

};
