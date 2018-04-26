const utils = require('../modules/utils');
const neo4j = require('../modules/neo4j-request');

module.exports = {

	query: function (req, res) {

		const name = req.query.query || '';

		const q = `
			MATCH (tag:TAG:UH4D)
			WHERE tag.id =~ $value
			RETURN tag.id AS tag`;

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
