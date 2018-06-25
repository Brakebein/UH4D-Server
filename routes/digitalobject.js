const utils = require('../modules/utils');
const neo4j = require('../modules/neo4j-request');

module.exports = {

	query: function (req, res) {
		
		let q = `
			MATCH (event:D7:UH4D)-[:L11]->(dobj:D1)-[:P106]->(file:D9)
			OPTIONAL MATCH (dobj)-[rmat:P2]->(mat:E57)
			WITH event, dobj, file, mat
			ORDER BY rmat.order
			WITH event, dobj, file, collect(mat) AS materials
			OPTIONAL MATCH (dobj)<-[:P106]-(parent:D1)
			RETURN dobj.id AS id,
				   event.id AS eventId,
				   dobj AS obj,
				   file AS file,
				   materials,
				   parent.id AS parent`;
		
		neo4j.readTransaction(q)
			.then(function (results) {
				res.json(results);
			})
			.catch(function (err) {
				utils.error.neo4j(res, err, '#digitalobject.query');
			});
	},

	get: function (req, res) {

		let q = `
			MATCH (dobj:D1:UH4D {id: $objectId})<-[:L11]-(event:D7),
				(dobj)-[:P106]->(file:D9)
			OPTIONAL MATCH (dobj)-[rmat:P2]->(mat:E57)
			WITH event, dobj, file, mat
			ORDER BY rmat.order
			WITH event, dobj, file, collect(mat) AS materials
			OPTIONAL MATCH (dobj)<-[:P106]-(parent:D1)
			RETURN dobj.id AS id,
				   event.id AS eventId,
				   dobj AS obj,
				   file AS file,
				   materials,
				   parent.id AS parent`;

		let params = {
			objectId: req.params.id
		};

		neo4j.readTransaction(q, params)
			.then(function (results) {
				res.json(results[0]);
			})
			.catch(function (err) {
				utils.error.neo4j(res, err, '#digitalobject.get');
			});
	}

};
