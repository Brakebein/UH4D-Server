const utils = require('../modules/utils');
const neo4j = require('neo4j-request');

module.exports = {

	queryPersons: function (req, res) {

		const name = req.query.name || '';

		const q = `
			MATCH (e21:E21:UH4D)-[:P131]->(name:E82)
			WHERE name.value =~ $value
			RETURN e21.id AS id, name.value AS name`;

		const params = {
			value: `(?i).*${name}.*`
		};

		neo4j.readTransaction(q, params)
			.then(function (results) {
				res.json(results);
			})
			.catch(function (err) {
				utils.error.neo4j(res, err, 'author.query');
			});

	},

	queryLegalBodies: function (req, res) {

		const name = req.query.name || '';

		const q = `
			MATCH (e40:E40:UH4D)-[:P131]->(name:E82)
			WHERE name.value =~ $value
			RETURN e40.id AS id, name.value AS name`;

		const params = {
			value: `(?i).*${name}.*`
		};

		neo4j.readTransaction(q, params)
			.then(function (results) {
				res.json(results);
			})
			.catch(function (err) {
				utils.error.neo4j(res, err, 'author.query');
			});

	}

};
