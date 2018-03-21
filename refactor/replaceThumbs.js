const config = require('../config');
const utils = require('../modules/utils');
const neo4j = require('../modules/neo4j-request');
const execFile = require('child-process-promise').execFile;
const fs = require('fs-extra-promise');
const request = require('request-promise');
const Promise = require('bluebird');

request.get('http://localhost:3001/image')
.then(function (response) {
	let results = JSON.parse(response);

	Promise.mapSeries(results, function (item) {
		return processItem(item);
	})
		.then(function () {
			console.log('All done!');
			process.exit();
		})
		.catch(function (err) {
			console.error('Something went wrong', err);
			process.exit();
		});
});

function processItem(item) {

	let path = config.path.data + '/' + item.file.path;

	return fs.ensureDirAsync(path)
		.then(function () {
			if (item.file.texture && item.file.texturePreview)
				return Promise.resolve();
			else
				return Promise.reject('No textures available.');
		})
		.then(function () {
			// remove texture file
			return fs.unlinkAsync(path + item.file.texture);
		})
		.then(function () {
			// remove remove texture preview file
			return fs.unlinkAsync(path + item.file.texturePreview);
		})
		.then(function () {
			// recreate thumbnail
			return execFile(config.exec.ImagickConvert, [path + item.file.original, '-resize', '200x200>', path + item.file.thumb]);
		})
		.then(function () {
			// recreate preview image
			return execFile(config.exec.ImagickConvert, [path + item.file.original, '-resize', '2048x2048>', path + item.file.preview]);
		})
		.then(function () {
			// update database entry
			let query = `
				MATCH (image:E38:UH4D {id: $id})-[:P106]->(file:D9)
				REMOVE file.texture, file.texturePreview
				RETURN file`;
			return neo4j.writeTransaction(query, {id: item.id});
		})
		.then(function (response) {
			if (!response || response.error || response.errors)
				return Promise.reject('neo4j error', response);
			else
				return Promise.resolve();
		})
		.catch(function (reason) {
			console.error(reason);
			return Promise.reject(reason);
		});
}