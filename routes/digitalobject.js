const utils = require('../modules/utils'),
	neo4j = require('../modules/neo4j-request'),
	shortid = require('shortid'),
	moment = require('moment');


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
				if (!fromDate.isValid() || (req.body.date.to && moment(req.body.date.to).isAfter(fromDate))) {
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
				if (!toDate.isValid() || (req.body.date.from && moment(req.body.date.from).isBefore(toDate))) {
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
				utils.error.neo4j(res, err, 'digitalobject.update');
			});
	}

};
