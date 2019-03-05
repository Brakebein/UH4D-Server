const log4js = require('log4js');
const fs = require('fs-extra-promise');
const request = require('request-promise');
const Promise = require('bluebird');
const XmlStream = require('xml-stream');
const execFile = require('child-process-promise').execFile;
const neo4j = require('./modules/neo4j-request');
const uuid = require('uuid/v4');
const shortid = require('shortid');
const config = require('./config');
const utils = require('./modules/utils');

log4js.configure({
	appenders: {
		out: { type: 'console' }
	},
	categories: {
		default: { appenders: ['out'], level: 'all' }
	}
});
const logger = log4js.getLogger('parse-dfd');
// log4js.replaceConsole(logger);
console.log = logger.info.bind(logger);
console.debug = logger.debug.bind(logger);
console.warn = logger.warn.bind(logger);
console.error = logger.error.bind(logger);

let retrievalPath;

if (process.argv[2] && typeof process.argv[2] === 'string')
	retrievalPath = process.argv[2];
else {
	console.error('No folder specified!');
	process.exit(1);
}

// read directory with images
fs.readdirAsync(retrievalPath)
	.then(function (files) {

		//files.splice(0, 45);

		return Promise.mapSeries(files, function (file, index, length) {

				console.log('Process ' + index + ' / ' + length, file);
				return new Promise(function (resolve, reject) {
					setTimeout(function () {
						processWorkflow(file)
							.then(resolve)
							.catch(reject);
					}, 1000);
				});

		});

		//let file = files[1];
		//let file = 'df_hauptkatalog_0096774.jpg';
		// let file = 'df_bika031_0001029_motiv.jpg';
		// let file = 'df_bo-pos-01_0000335.jpg';
		// return new Promise(function (resolve, reject) {
		// 	setTimeout(function () {
		// 		processWorkflow(file)
		// 			.then(resolve)
		// 			.catch(reject);
		// 	}, 1000);
		// });
	})
	.then(function () {
		console.debug('Done!');
		process.exit();
	})
	.catch(function (reason) {
		if (reason)
			console.error(reason);
		else
			console.error('Something failed!');
		process.exit(1);
	});

function processWorkflow(file) {

	let meta = {};

	return searchDFD(file)
		.then(function (permalink) {
			meta.permalink = permalink;

			return checkDatabaseEntry(permalink);
			// return requestDFDSite(permalink);
		})
		.then(function (exists) {
			if (exists)
			// continue with next file
				return Promise.resolve();
			else
			// continue with processing
				return requestDFDSite(meta.permalink)
					.then(function (tmpFile) {

						return parseHTMLFile(tmpFile);
					})
					.then(function (value) {
						Object.assign(meta, value);
						//console.log(meta);

						return processImage(file);
					})
					.then(function (imageMeta) {
						meta.file = imageMeta;
						//console.log(meta);

						return writeData(meta);
					})
					.then(function (result) {
						console.log(result);
						return Promise.resolve();
					})
					.catch(function (reason) {
						console.error(reason);

						// cleanup
						if (meta.file && meta.file.path) {
							let rmPath = config.path.data + '/' + meta.file.path;
							fs.existsAsync(rmPath)
								.then(function (exists) {
									if (exists) {
										console.warn('Unlink directory:', rmPath);
										return fs.removeAsync(rmPath);
									}
								})
								.catch(function (reason) {
									console.err('Unlink directory failed:', rmPath, reason);
								});
						}

						return Promise.reject();
					});
		});
}

// search DFD for filename and parse permalink
function searchDFD(file) {
	console.log('Search:', file);

	let baseFilename = file.substr(0, file.lastIndexOf('.'));
	let url = 'http://www.deutschefotothek.de/ete?action=query&refine=Suchen&desc=' + baseFilename;

	return request(url)
		.then(function (htmlString) {

			let pattern = /<p class="description">\s*<a\shref="([^"]*)"/;
			let matches = pattern.exec(htmlString);
			console.debug(matches[1]);

			return Promise.resolve(matches[1]);
		});
}

function checkDatabaseEntry(permalink) {

	let q = `
		MATCH (image:E38:UH4D)-[:P48]->(:E42:UH4D {permalink: $identifier})
		RETURN image`;

	let params = {
		identifier: permalink
	};

	return neo4j.readTransaction(q, params)
		.then(function (results) {

		});
}

// request DFD details site and save temporally
function requestDFDSite(url) {

	let tmpFile = 'tmp.html';

	return request(url, {
		encoding: null
	})
		.then(function (buffer) {

			let htmlString = buffer.toString('latin1');
			htmlString = htmlString.replace(/<script><img.*<\/script>/g, '');
			htmlString = htmlString.replace(/&quot([^;])/g, '&quot;$1');

			return fs.writeFileAsync(tmpFile, htmlString, {encoding: 'latin1'});
		})
		.then(function () {
			return Promise.resolve(tmpFile);
		});
}

// parse temporally saved HTML page for metadata
function parseHTMLFile(file) {
	return new Promise(function (resolve, reject) {

		let meta = {};

		let stream = fs.createReadStream(file);
		stream.on('close', function () {
			//console.debug('readstream closed');
		});

		let xml = new XmlStream(stream);

		xml.collect('strong');
		xml.preserve('p');
		xml.preserve('div');

		xml.on('endElement: h1 > strong', function (item) {
			//console.log(item);
			meta.title = item.$text;
		});

		xml.on('endElement: a', function (item) {
			if (item.$ && item.$.class && item.$.class === 'download') {
				//console.log(item);
				meta.fileLink = item.$.href;
			}
		});

		xml.on('endElement: p', function (item) {
			if (item.$ && item.$.class && item.$.class === 'description') {
				//console.log(item);
				Object.assign(meta, parseDescription(item.$children));
			}
		});

		xml.on('endElement: div', function (item) {
			if (item.$ && item.$.class && item.$.class === 'detailsContent') {
				//console.log(item);
				Object.assign(meta, parseDetails(item.$children));
			}
		});

		xml.on('end', function () {
			resolve(meta);
		});

	});
}

// parse description section
function parseDescription(array) {

	let desc = {
		misc: []
	};

	for (let i = 0, l = array.length; i < l; i++) {
		let el = array[i];

		if (typeof el === 'string' && /foto:/i.test(el)) {
			// if no name, only date
			if (/Foto:\s[0-9.\/]+/.test(el)) {
				desc.date = /Foto:\s([0-9.\/]+)/.exec(el)[1];
			}
			else if (/Foto:\s.+,\s[0-9.\/]+/.test(el)) {
				let matches = /Foto:\s(.+),\s([0-9.\/]+)/.exec(el);
				desc.author = matches[1];
				desc.date = matches[2];
			}
			// if next element is 'strong' tag -> author
			else if (array[i + 1] instanceof Object) {
				desc.author = array[i + 1].$text;
				i++;

				// if 3rd element is date
				if (typeof array[i + 1] === 'string' && /[0-9.\/]+/.test(array[i + 1])) {
					desc.date = /([0-9.\/]+)/.exec(array[i + 1])[1];
					i++;
				}
			}
		}

		else if (typeof el === 'string' && /eigentümer/i.test(el)) {
			desc.owner = array[i + 1].$text;
			i++;
		}

		else if (typeof el === 'string' && /^Detail:/i.test(el)) {
			desc.description = /^Detail: (.*)/.exec(el)[1];
			i++;
		}

		else if (typeof el === 'string' && /aufn\.-nr/i.test(el)) {
			desc.captureNo = array[i + 1].$text;
			i++;
		}

		else if (typeof el === 'string') {
			desc.misc.push(el);
		}
	}

	return desc;

}

// parse details section
function parseDetails(array) {

	let details = {};

	for (let i = 0, l = array.length; i < l; i++) {
		let el = array[i];

		if (el instanceof Object) {
			if (/stichwörter/i.test(el.$text)) {
				//console.log(array[i + 1]);
				if (array[i + 1].$children && typeof array[i + 1].$children[0] === 'string')
					details.tags =  array[i + 1].$children[0].split(/,\s*/);
				//details.tags = /^([^:]+)(?=(?:\s+\S+:|$))/.exec(array[i + 1].$text)[1].split(/,\s*/);
				i++;
			}
			else if (/beschreibung:/i.test(el.$text)) {
				details.description = /Beschreibung:\s(.*)/.exec(el.$text)[1];
			}
			// else if (/datierung:/i.test(el.$text)) {
			// 	details.date = /Datierung:\s(.*)/.exec(el.$text)[1];
			// }
			else if (/verwalter:/i.test(el.$text)) {
				details.custodian = /Verwalter:\s(.*)/.exec(el.$text)[1];
			}
		}
	}

	return details;
}

function processImage(file) {

	let shortPath = 'images/' + uuid() + '/',
		path = config.path.data + '/' + shortPath,
		filename = utils.replace(file),
		filenameThumb = filename.slice(0, filename.lastIndexOf(".")) + '_thumb.jpg',
		filenamePreview = filename.slice(0, filename.lastIndexOf(".")) + '_preview.jpg';
	// let filenameTexture = filename.slice(0, filename.lastIndexOf(".")) + '_tex.jpg';
	// let filenameTexturePreview = filename.slice(0, filename.lastIndexOf(".")) + '_tex_preview.jpg';

	let imgWidth, imgHeight;

	// create directory
	return fs.ensureDirAsync(config.path.data + '/images')
		.then(function () {
			// copy image into directory
			return fs.copyAsync(retrievalPath + '/' + file, path + filename);
		})
		.then(function () {
			// create thumbnail
			return execFile(config.exec.ImagickConvert, [path + filename, '-resize', '200x200>', path + filenameThumb]);
			// return execFile(config.exec.ImagickConvert, [path + filename, '-resize', '160x90^', '-gravity', 'center', '-extent', '160x90', path + filenameThumb]);
		})
		.then(function () {
			// downsample preview images
			return execFile(config.exec.ImagickConvert, [path + filename, '-resize', '2048x2048>', path + filenamePreview]);
			// return execFile(config.exec.ImagickConvert, [path + filename, '-resize', '1024x1024>', path + filenamePreview]);
		})
		// .then(function () {
		// 	// sample image to texture with resolution power of 2
		// 	return utils.resizeToNearestPowerOf2(path, filename, filenameTexture);
		// })
		// .then(function (value) {
		// 	imgWidth = value.originalWidth;
		// 	imgHeight = value.originalHeight;
		//
		// 	// downsample image to preview texture
		// 	return execFile(config.exec.ImagickConvert, [path + filename, '-resize', '128x128!', path + filenameTexturePreview]);
		// })
		.then(function () {
			return Promise.resolve({
				path: shortPath,
				original: filename,
				type: filename.split('.').pop().toLowerCase(),
				preview: filenamePreview,
				thumb: filenameThumb,
				// texture: filenameTexture,
				// texturePreview: filenameTexturePreview,
				width: imgWidth,
				height: imgHeight
			});
		});
}

function writeData(data) {

	let q = `
		MATCH (tdesc:E55:UH4D {id: "image_description"}), (tmisc:E55:UH4D {id: "image_miscellaneous"})
		CREATE (image:E38:UH4D {id: $imageId}),
			(image)-[:P102]->(title:E35:UH4D $title),
			(image)-[:P106]->(file:D9:UH4D $file),
			(image)-[:P48]->(identifier:E42:UH4D $identifier),
			(image)<-[:P94]-(e65:E65:UH4D {id: $e65id}) `;

	if (data.author)
		q += `MERGE (author:E21:UH4D)-[:P131]->(authorName:E82:UH4D {value: $author.value})
			ON CREATE SET author.id = $authorId, authorName.id = $author.id
		CREATE (e65)-[:P14]->(author) `;
		
	if (data.date)
		q += `CREATE (e65)-[:P4]->(:E52:UH4D {id: $e52id})-[:P82]->(date:E61:UH4D {value: $date}) `;
		
	if (data.owner)
		q += `MERGE (owner:E40:UH4D)-[:P131]->(ownerName:E82:UH4D {value: $owner.value})
			ON CREATE SET owner.id = $ownerId, ownerName.id = $owner.id
		CREATE (image)-[:P105]->(owner) `;

	if (data.description)
		q += `CREATE (image)-[:P3]->(desc:E62:UH4D $desc)-[:P3_1]->(tdesc) `;

	if (data.misc.length)	
		q += `CREATE (image)-[:P3]->(:E62:UH4D $misc)-[:P3_1]->(tmisc) `;
		
	q += `FOREACH (tag IN $tags |
			MERGE (t:TAG:UH4D {id: tag})
			MERGE (image)-[:has_tag]->(t)
		)
		
		RETURN image`;

	let id = shortid.generate() + '_' + data.file.original;

	let authorId = shortid.generate() + '_' + utils.replace(data.author);
	let ownerId = shortid.generate() + '_' + utils.replace(data.owner);

	let params = {
		imageId: id,
		title: {
			id: 'e35_' + id,
			value: data.title
		},
		identifier: {
			id: 'e42_' + id,
			permalink: data.permalink,
			slub_id: data.permalink.split('/').pop(),
			slub_cap_no: data.captureNo
		},
		file: Object.assign({ id: 'd9_' + id }, data.file),
		e65id: 'e65_' + id,
		e52id: 'e52_' + id,
		date: data.date,
		author: {
			id: 'e82_' + authorId,
			value: data.author
		},
		authorId: 'e21_' + authorId,
		owner: {
			id: 'e82_' + ownerId,
			value: data.owner
		},
		ownerId: 'e40_' + ownerId,
		desc: {
			id: 'e62_desc_' + id,
			value: data.description
		},
		misc: {
			id: 'e62_misc_' + id,
			value: data.misc.join(', ')
		},
		tags: data.tags || []
	};

	return neo4j.writeTransaction(q, params)
		.then(function (results) {
			return Promise.resolve(results[0]);
		});
}
