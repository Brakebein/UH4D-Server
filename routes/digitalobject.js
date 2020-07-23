const config = require('../config'),
	utils = require('../modules/utils'),
	neo4j = require('neo4j-request'),
	shortid = require('shortid'),
	moment = require('moment'),
	fs = require('fs-extra-promise'),
	Promise = require('bluebird');


function createHierarchy(data) {
	for (let i = 0; i < data.length; i++) {
		let obj = data[i];

		if (!obj.children) obj.children = [];
		if (obj.parent) {
			let parent = getObjectById(data, obj.parent);
			if (parent) {
				if (!parent.children) parent.children = [];
				parent.children.push(obj);
				data.splice(i, 1);
				i--;
			}
		}
	}

	return data;
}

function getObjectById(data, id) {
	for (let i = 0; i < data.length; i++) {
		if (data[i].id === id) return data[i];
		if (data[i].children) {
			let obj = getObjectById(data[i].children, id);
			if (obj !== undefined) return obj;
		}
	}
	return undefined;
}


module.exports = {

	query: function (req, res) {

		// check query parameter
		let date = req.query.modelDate ? moment(req.query.modelDate) : null;
		if (date && !date.isValid())
			date = null;

		let params = {};

		// language=Cypher
		let q = `
			MATCH (e22:E22:UH4D)-[:P1]->(name:E41)
			MATCH (e22)-[:P67|P106*1..]-(obj:D1)
			MATCH (obj)<-[:L11]-(event:D7),
				  (obj)-[:P106]->(file:D9)
			
			OPTIONAL MATCH (e22)<-[:P108]-(:E12)-[:P4]->(:E52)-[:P82]->(from:E61)
			OPTIONAL MATCH (e22)<-[:P13]-(:E6)-[:P4]->(:E52)-[:P82]->(to:E61)`;

		if (date) {
			q += `
			WITH e22, event, obj, file, name, from, to
            WHERE (from IS NULL OR from.value < date($date)) AND (to IS NULL OR to.value > date($date))`;

			params.date = date.format('YYYY-MM-DD');
		}

		// language=Cypher
		q += `
			WITH e22, event, obj, file, name, {from: toString(from.value), to: toString(to.value)} AS date
			
			OPTIONAL MATCH (obj)-[rmat:P2]->(mat:E57)
			WITH e22, event, obj, file, name, date, mat
			  ORDER BY rmat.order
			WITH e22, event, obj, file, name, date, collect(mat) AS materials
			OPTIONAL MATCH (obj)<-[:P106]-(parent:D1)
			RETURN e22.id AS id,
				   name.value AS name,
				   date,
				   collect({id: obj.id,
					eventId:   event.id,
					obj:       obj,
					file:      file,
					materials: materials,
					parent:    parent.id
				   }) AS object;`;

		
		neo4j.readTransaction(q, params)
			.then(function (results) {
				results.forEach(function (value) {
					createHierarchy(value.object);
					if (value.object.length === 1)
						value.object = value.object[0];
					else
						console.warn('No single root object', value.object);
				});
				res.json(results);
			})
			.catch(function (err) {
				utils.error.neo4j(res, err, '#digitalobject.query');
			});
	},

	get: function (req, res) {

		// language=Cypher
		let q = `
			MATCH (e22:E22:UH4D {id: $id})-[:P1]->(name:E41)
			MATCH (e22)-[:P67|P106*1..]-(obj:D1)
			MATCH (obj)<-[:L11]-(event:D7),
				  (obj)-[:P106]->(file:D9)
			
			OPTIONAL MATCH (e22)<-[:P108]-(:E12)-[:P4]->(:E52)-[:P82]->(from:E61)
			OPTIONAL MATCH (e22)<-[:P13]-(:E6)-[:P4]->(:E52)-[:P82]->(to:E61)
			WITH e22, event, obj, file, name, {from: toString(from.value), to: toString(to.value)} AS date
			
			OPTIONAL MATCH (obj)-[rmat:P2]->(mat:E57)
			WITH e22, event, obj, file, name, date, mat
			  ORDER BY rmat.order
			WITH e22, event, obj, file, name, date, collect(mat) AS materials
			OPTIONAL MATCH (obj)<-[:P106]-(parent:D1)
			RETURN e22.id AS id,
				   name.value AS name,
				   date,
				   collect({id:        obj.id,
					eventId:   event.id,
					obj:       obj,
					file:      file,
					materials: materials,
					parent:    parent.id
				   }) AS object;`;

		let params = {
			id: req.params.id
		};

		neo4j.readTransaction(q, params)
			.then(function (results) {
				let value = results[0];
				if (value) {
					createHierarchy(value.object);
					if (value.object.length === 1)
						value.object = value.object[0];
					else
						console.warn('No single root object', value.object);
				}
				res.json(value);
			})
			.catch(function (err) {
				utils.error.neo4j(res, err, '#digitalobject.get');
			});
	},

	update: function (req, res) {

		let id = shortid.generate();

		let q = `MATCH (e22:E22:UH4D {id: $id})<-[:P67]-(obj:D1) `;
		let params = {
			id: req.params.id
		};

		switch (req.query.prop) {
			case 'name':
				q += `MATCH (e22)-[:P1]->(name:E41)
					SET name.value = $name`;
				params.name = req.body.name;
				break;
			case 'from':
				let fromDate = moment(req.body.date.from);
				if (!fromDate.isValid() || (req.body.date.to && moment(req.body.date.to).isBefore(fromDate))) {
					res.json();
					return;
				}
				q += `
					MERGE (e22)<-[:P108]-(e12:E12:UH4D)-[:P4]->(e52:E52:UH4D)-[:P82]->(date:E61:UH4D)
					ON CREATE SET e12.id = $e12id, e52.id = $e52id
					SET date.value = date($date)`;
				params.e12id = 'e12_' + id;
				params.e52id = 'e52_e12_' + id;
				params.date = fromDate.format('YYYY-MM-DD');
				break;
			case 'to':
				let toDate = moment(req.body.date.to);
				if (!toDate.isValid() || (req.body.date.from && moment(req.body.date.from).isAfter(toDate))) {
					res.json();
					return;
				}
				q += `
					MERGE (e22)<-[:P13]-(e6:E6:UH4D)-[:P4]->(e52:E52:UH4D)-[:P82]->(date:E61:UH4D)
					ON CREATE SET e6.id = $e6id, e52.id = $e52id
					SET date.value = date($date)`;
				params.e6id = 'e6_' + id;
				params.e52id = 'e52_e6_' + id;
				params.date = toDate.format('YYYY-MM-DD');
				break;
		}

		q += ' RETURN obj';

		neo4j.readTransaction(q, params)
			.then(function () {
				res.json(req.body)
			})
			.catch(function (err) {
				utils.error.neo4j(res, err, '#digitalobject.update');
			});
	},

	save: function (req, res) {

		const data = req.body,
			oldPath = data.object.file.path,
			newPath = oldPath.replace(/^temp\//, 'models/');

		// move directory
		Promise.try(function () {
			if (oldPath === newPath)
				throw new Error('Wrong temp path provided: ' + oldPath);

			return fs.existsAsync(config.path.data + '/' + oldPath);
		})
			.then(function (exists) {
				if (exists)
					return fs.renameAsync(config.path.data + '/' + oldPath, config.path.data + '/' + newPath);
				else
					return Promise.reject('Path doesn\'t exist: ' + oldPath);
			})
			.catch(function (err) {
				utils.error.server(res, err, '#digitalobject.save');
				return Promise.reject();
			})
			.then(function () {
				// query
				const statements = [];

				// create digital event node
				statements.push({
					statement: `MERGE (d7:D7:UH4D {id: $id}) RETURN d7`,
					parameters: {id: data.object.eventId}
				});

				function prepareStatements(nodes) {
					nodes.forEach(function (node) {

						// language=Cypher
						let q = `
							MATCH (event:D7:UH4D {id: $eventId}) ${node.parent ? ', (parent:D1:UH4D {id: $parentId})' : ''}
							MERGE (obj:D1:UH4D {id: $obj.id})
							ON CREATE SET obj = $obj
							MERGE (file:D9:UH4D {id: $file.id})
							ON CREATE SET file = $file
							CREATE (event)-[:L11]->(obj)-[:P106]->(file)`;

						if (node.parent)
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

						node.file.path = newPath;
						node.materials.forEach(function (mat) {
							mat.path = newPath + 'maps/';
						});

						const params = {
							eventId: node.eventId,
							obj: node.obj,
							file: node.file,
							materials: node.materials
						};
						if (node.parent)
							params.parentId = node.parent;
						else {
							params.e22id = data.id;
							params.e41 = {
								id: 'e41_' + data.id,
								value: data.name
							};
						}

						statements.push({statement: q, parameters: params});

						prepareStatements(node.children);
					});
				}

				prepareStatements([data.object]);

				return neo4j.multipleStatements(statements);
			})
			.then(function (results) {
				console.log(results);
				res.json(data);
			})
			.catch(function (err) {
				if (err) {
					utils.error.neo4j(res, err, '#digitalobject.save');
					utils.unlinkDir(config.path.data + '/' + newPath);
				}
			});

	},

	deleteTemp: function (req, res) {

		if (!req.body.object.file.path || !/^temp\//.test(req.body.object.file.path)) {
			res.status(400);
			res.json({
				message: 'Path refers not to temp directory!'
			});
			return;
		}

		utils.unlinkDir(config.path.data + '/' + req.body.object.file.path)
			.then(function () {
				res.json({
					message: 'Temporal files deleted!'
				});
			});

	},
	
	duplicate: function (req, res) {

		const id = shortid.generate();

		// TODO: consider links to images

		// language=Cypher
		const q = `
			MATCH (e22old:E22:UH4D {id: $id})
			CREATE (e22new:E22:UH4D {id: $e22id})-[:P1]->(e41:E41:UH4D $e41)
			WITH e22old, e22new
			MATCH (e22old)<-[:P67]-(obj:D1)
			CREATE (e22new)<-[:P67]-(obj)
			RETURN e22new`;

		const params = {
			id: req.params.id,
			e22id: 'e22_' + id + '_' + utils.replace(req.body.name),
			e41: {
				id: 'e41_' + id + '_' + utils.replace(req.body.name),
				value: req.body.name + ' Duplicate'
			}
		};

		neo4j.writeTransaction(q, params)
			.then(function (results) {
				console.log(results[0]);
				res.json(req.body);
			})
			.catch(function (err) {
				utils.error.neo4j(res, err, '#digitalobject.duplicate')
			});
	}

};
