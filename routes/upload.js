const config = require('../config'),
	utils = require('../modules/utils'),
	fork = require('child_process').fork,
	fs = require('fs-extra-promise'),
	shortid = require('shortid'),
	uuid = require('uuid/v4'),
	Promise = require('bluebird'),
	mime = require('mime-types');

module.exports = function (req, res) {

	utils.log.fileupload(req.file);
	const file = req.file;

	const sid = shortid.generate(),
		shortPath = 'temp/' + uuid() + '/',
		path = config.path.data + '/' + shortPath,
		filename = sid + '_' + utils.replace(req.file.originalname);

	const params = {
		sid: sid,
		filename: filename,
		path: path,
		shortPath: shortPath,
		body: req.body
	};

	// create folder
	fs.ensureDirAsync(path)
		.then(function () {
			// move uploaded file into folder
			return fs.renameAsync(file.path, path + filename);
		})
		.catch(function (err) {
			utils.error.server(res, err, '#upload fs/exec @ ' + path + filename);
			return Promise.reject();
		})
		.then(function () {
			// lookup mime type and start processing
			switch (mime.lookup(file.originalname)) {

				case 'model/vnd.collada+xml':
					return processDae(params)
						.then(function (data) {
							return writeToJSON(data, params)
						});

				default:
					utils.abort.unsupportedFile(res, '#upload ' + file.originalname);
					return Promise.reject();

			}
		})
		.then(function (response) {
			// everything went well
			res.json(response);
		})
		.catch(function (err) {
			// error notification
			if (err) {
				switch (err.code) {
					case 'DAE-PROCESS':
						utils.error.general(res, err);
						break;
					case 'NEO4J':
						utils.error.neo4j(res, err, '#upload');
						break;
					default:
						utils.error.general(res, err);
				}
			}

			// remove files/directory
			utils.unlinkDir(path);
			utils.unlinkFile(file.path);
		});
};

function processDae(params) {
	return new Promise(function (resolve, reject) {
		// initialize process to handle dae file
		const forkDae = fork('process/dae-file', [ params.path + params.filename, params.sid, params.path ]);

		forkDae.on('message', function (response) {
			if (response.error)
				reject({
					code: 'DAE-PROCESS',
					data: response
				});
			else
				resolve(response);
		});

		forkDae.on('close', function (code) {
			if (code)
				reject({
					code: 'DAE-PROCESS',
					message: 'child process exited with code ' + code
				});
		});

	});
}

function writeToJSON(data, p) {

	function setObject(node, parentId, depth) {

		let ctm = p.filename,
			edges = undefined;

		if (node.files) {
			if (Array.isArray(node.files)) {
				ctm = node.files.map(function (f) { return f.ctm });
				edges = node.files.map(function (f) { return f.edges });
			}
			else {
				ctm = node.files.ctm;
				edges = node.files.edges;
			}
		}

		const map = {
			id: 'd1_' + p.sid + '_' + utils.replace(node.id),
			eventId: 'd7_' + p.sid,
			parent: parentId,
			obj: {
				id: 'd1_' + p.sid + '_' + utils.replace(node.id),
				nodeId: node.id,
				name: node.name,
				type: node.type,
				unit: node.unit,
				up: node.up,
				matrix: node.matrix
			},
			file: {
				id: 'd9_' + p.sid + '_' + utils.replace(node.id),
				path: p.shortPath,
				mesh: ctm,
				edges: edges,
				type: p.filename.split('.').pop(),
				original: p.filename,
				geometryId: node.geometryUrl
			},
			materials: []
		};

		if (node.material) {
			const mats = Array.isArray(node.material) ? node.material : [node.material];
			map.materials = mats.map(function (m) {
				return {
					id: 'e57_' + p.sid + '_' + utils.replace(m.id),
					materialId: m.id,
					name: m.name,
					path: p.shortPath + 'maps/',
					diffuse: m.map || m.color,
					alpha: m.alphaMap || null
				};
			});
		}

		map.children = node.children.map(function (child) {
			setObject(child, map.id, depth + 1);
		});

		return map;
	}

	let results = data.nodes.map(function (node) {
		return {
			id: 'e22_d1_' + utils.replace(p.filename),
			name: node.name,
			date: { from: null, to: null },
			object: setObject(node, null, 0)
		};
	});

	let result = results[0];
	if (!result)
		return Promise.reject('No objects created');

	// group multiple objects
	if (results.length > 2) {
		let groupId = 'd1_' + p.sid + '_' + results.map(function (node) { return node.object.obj.nodeId; }).join('_');
		result.name = results.map(function (node) { return node.name; }).join('_');
		result.object = {
			id: groupId,
			eventId: result.object.eventId,
			obj: Object.assign({}, result.object.obj, {
				id: groupId,
				name: result.name,
				nodeId: 'none',
				matrix: [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
				type: 'group'
			}),
			file: {
				id: 'd9_' + p.sid + '_none',
				mesh: p.filename,
				path: p.shortPath,
				original: p.filename,
				type: p.filename.split('.').pop()
			},
			materials: [],
			children: results.map(function (node) {
				node.object.parent = groupId;
				return node.object;
			})
		};
	}

	return fs.writeFileAsync(p.path + 'meta.json', JSON.stringify(result))
		.then(function () {
			return result;
		});

}

function writeToDB(data, p) {

	const statements = [];
	
	// create digital event node
	statements.push({
		statement: `MERGE (d7:D7:UH4D {id: $id}) RETURN d7`,
		parameters: { id: 'd7_' + p.sid }
	});
	
	function prepareStatements(nodes, parent) {
		nodes.forEach(function (node) {
			// skip cameras and lights
			if (node.type === 'camera' || node.type === 'light')
				return;

			// language=Cypher
			let q = `
				MATCH (event:D7:UH4D {id: $eventId}) ${parent ? ', (parent:D1:UH4D {id: $parentId})' : ''}
				MERGE (obj:D1:UH4D {id: $obj.id})
				ON CREATE SET obj = $obj
				MERGE (file:D9:UH4D {id: $file.id})
				ON CREATE SET file = $file
				CREATE (event)-[:L11]->(obj)-[:P106]->(file)`;

			if (parent)
				q += `
					CREATE (parent)-[:P106]->(obj)`;
			else
				q += `
					CREATE (obj)-[:P67]->(:E22:UH4D {id: $e22id})-[:P1]->(:E41:UH4D $e41)`;

			q += `
				WITH obj
				UNWIND range(0, size($materials) - 1) AS i
				MERGE (e57:E57:UH4D {id: $materials[i].id})
				ON CREATE SET e57 = $materials[i]
				CREATE (obj)-[:P2 {order: i}]->(e57)
				
				RETURN DISTINCT obj`;

			let ctm = p.filename,
				edges = undefined;

			if (node.files) {
				if (Array.isArray(node.files)) {
					ctm = node.files.map(function (f) { return f.ctm });
					edges = node.files.map(function (f) { return f.edges });
				}
				else {
					ctm = node.files.ctm;
					edges = node.files.edges;
				}
			}

			const params = {
				eventId: 'd7_' + p.sid,
				parentId: 'd1_' + p.sid + '_' + utils.replace(node.parentid),
				e22: {
					id: 'e22_d1_' + p.sid + '_' + utils.replace(node.id),
					value: node.name
				},
				obj: {
					id: 'd1_' + p.sid + '_' + utils.replace(node.id),
					nodeId: node.id,
					name: node.name,
					type: node.type,
					unit: node.unit,
					up: node.up,
					matrix: node.matrix
				},
				file: {
					id: 'd9_' + p.sid + '_' + utils.replace(node.id),
					path: p.shortPath,
					mesh: ctm,
					edges: edges,
					type: p.filename.split('.').pop(),
					original: p.filename,
					geometryId: node.geometryUrl
				},
				materials: []
			};

			if (node.material) {
				const mats = Array.isArray(node.material) ? node.material : [node.material];
				map.materials = mats.map(function (m) {
					return {
						id: 'e57_' + p.sid + '_' + utils.replace(m.id),
						materialId: m.id,
						name: m.name,
						path: p.shortPath + 'maps/',
						diffuse: m.map || m.color,
						alpha: m.alphaMap || null
					};
				});
			}

			if (parent)
				params.parentId = parent.id;
			else {
				params.e22Id = 'e22_d1_' + p.sid + '_' + utils.replace(node.id);
				params.e41 = {
					id: 'e41_d1_' + p.sid + '_' + utils.replace(node.id),
					value: node.name
				};
			}

			statements.push({ statement: q, parameters: params });

			prepareStatements(node.children, params.obj);
		});
	}
	prepareStatements(data.nodes);

	return neo4j.multipleStatements(statements)
		.catch(function (err) {
			return Promise.reject({
				code: 'NEO4J',
				data: err
			});
		});

}