const config = require('../config');
const Promise = require('bluebird');
const fs = require('fs-extra-promise');
const exec = require('child-process-promise').execFile;

const utils = {

	error: {
		mysql: function (res, err, code) {
			let message = 'MySQL failure';
			if (code) message += ' ' + code;
			console.error(message, "\n", err);
			res.status(500);
			res.json({
				message: message,
				originalErr: err
			});
		},
		neo4j: function (res, err, code) {
			let message = 'Neo4j failure';
			if (code) message += ' ' + code;
			console.error(message, "\n", err);
			res.status(500);
			res.json({
				message: message,
				originalErr: err
			});
		},
		server: function (res, err, code) {
			let message = 'server failure';
			if (code) message += ' ' + code;
			console.error(message, "\n", err);
			res.status(500);
			res.json({
				message: message,
				originalErr: err
			});
		},
		general: function (res, err) {
			console.error(err);
			res.status(500);
			res.json({
				message: 'ERROR',
				error: err
			});
		}
	},

	abort: {
		missingData: function (res, add) {
			let message = 'Missing essential data';
			if (add) message += ' | ' + add;
			console.warn(message);
			res.status(400);
			res.json({
				message: message
			});
		},
		unsupportedFile: function (res, add) {
			let message = 'Unsupported file format';
			if (add) message += ' | ' + add;
			console.warn(message);
			res.status(415);
			res.json({
				message: message
			});
		}
	},

	log: {
		fileupload: function (files) {
			if(files instanceof Array) {
				files.forEach(function (f) {
					console.log('File Upload:', f.originalname, f.path, f.size);
				});
			}
			else if(files instanceof Object) {
				console.log('File Upload:', files.originalname, files.path, files.size);
			}
		}
	},
	
	replace: function (string) {
		if (typeof string !== 'string') return string;
		return string.replace(/[^a-zA-Z0-9_\-.]/g, '_');
	},

	unlinkDir: function (path) {
		return fs.existsAsync(path)
			.then(function (exists) {
				if (exists) {
					console.warn('Unlink directory:', path);
					return fs.removeAsync(path);
				}
			})
			.catch(function (err) {
				console.error('Unlink directory failed:', path, err);
			});
	},

	unlinkFile: function (path) {
		return fs.existsAsync(path)
			.then(function (exists) {
				if (exists) {
					console.warn('Unlink file:', path);
					return fs.unlinkAsync(path);
				}
			})
			.catch(function (err) {
				console.error('Unlink file failed:', path, err);
			});
	}

};

/**
 * Compute best fitting resolution with power of 2 (maximum 2048) and resize image.
 * @param path {string} Path to directory
 * @param filename {string} File name
 * @param outputname {string=} File name of the resized image. If omitted, the new file name will be combination of the `filename` and the computed resolution.
 * @return {Promise<Object>} Promise with object containing the file name of the resized image and the old and new image width/height.
 */
utils.resizeToNearestPowerOf2 = function (path, filename, outputname) {

	let width = 0, w = 0,
		height = 0, h = 0;

	return exec(config.exec.ImagickIdentify, [path + filename])
		.then(function (result) {
			let matches = result.stdout.match(/\s(\d+)x(\d+)\s/);

			width = +matches[1];
			height = +matches[2];
			w = 256;
			h = 256;

			while(w < width && w < 2048) {
				w *= 2;
			}
			while(h < height && h < 2048) {
				h *= 2;
			}

			if (!outputname)
				outputname = filename.split('.').shift() + '_' + w + 'x' + h + '.jpg';

			return exec(config.exec.ImagickConvert, [
				path + filename,
				'-resize', w + 'x' + h + '!',
				path + outputname
			]);
		})
		.then(function () {
			return Promise.resolve({
				name: outputname,
				width: w,
				height: h,
				originalWidth: width,
				originalHeight: height
			});
		})
		.catch(function (err) {
			return Promise.reject({
				code: 'IMAGEMAGICK',
				err: err
			});
		});
};
	
module.exports = utils;
