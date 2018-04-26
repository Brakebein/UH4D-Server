const utils = require('../modules/utils');
const neo4j = require('../modules/neo4j-request');

module.exports = {

	query: function (req, res) {

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

	}

};
