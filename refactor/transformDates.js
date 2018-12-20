/**
 * refactor/transformDates.js
 * 2018-12-14
 *
 * 1. Upgrade Neo4j to version >=3.5.0
 * 2. Copy database to new Neo4j version
 * 3. Set dbms.allow_upgrade=true to upgrade database
 * (3.1. Update unique constraint index to new index provider)
 *
 * 4. Execute transformDates.js
 *
 * (optional) Remove unmatched date entries (e.g. '.')
 */

// requires
const neo4j = require('../modules/neo4j-request');
const parseDate = require('../modules/parseDate');


// language=Cypher
const qQuery = `
	MATCH (image:E38:UH4D)-[:P94]-(e65:E65)
	OPTIONAL MATCH (e65)-[:P4]->(:E52)-[:P82]->(date:E61)
	RETURN image.id AS id, date.value AS date
`;

// query entries

neo4j.readTransaction(qQuery)
	.then(function (results) {

		// test data
		// results = [
		// 	{id: 'sdw', date: '1937'},
		// 	{id: 'sdw', date: '1960.06'},
		// 	{id: 'sdw', date: '1954/1955'},
		// 	{id: 'sdw', date: '1952.01.15'},
		// 	{id: 'sdw', date: '29.08.2007'},
		// 	{id: 'sdw', date: 'um 1940'},
		// 	{id: 'sdw', date: 'vor 1945'},
		// 	{id: 'sdw', date: 'nach 1945'},
		// ];

		// language=Cypher
		const qUpdate = `
			MATCH (image:E38:UH4D {id: $imageId})-[:P94]-(e65:E65)
            MERGE(e65)-[:P4]->(e52:E52:UH4D)-[:P82]->(date:E61:UH4D)
              ON CREATE SET e52.id = $e52id
			SET date.value = $date.value,
				date.from = date($date.from),
				date.to = date($date.to),
				date.display = $date.display`;

		let statements = [];


		results.forEach(function (entry) {

			if (!entry.date) return;

			let date = parseDate(entry.date);

			if (!date) return;

			statements.push({
				statement: qUpdate,
				parameters: {
					imageId: entry.id,
					e52id: 'e52_' + entry.id,
					date: date
				}
			});

		});

		// execute cypher queries
		return neo4j.multipleStatements(statements);
	})
	.then(function () {

		console.log('Everything went well!');

		process.exit();

	})
	.catch(function (err) {

		console.error(err);

	});
