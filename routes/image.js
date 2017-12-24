const utils = require('../modules/utils');
const neo4j = require('../modules/neo4j-request');

module.exports = {

	query: function (req, res) {
		console.log(req.query);

		let term = req.query.query ? req.query.query.split(/\s+/) : false;
		console.log(term);

		let regexTitle = [],
			regexAuthor = [],
			regexOwner = [],
			regexTag = [];

		let q = `
			MATCH (image:E38:UH4D)-[:P106]->(file:D9),
				(image)-[:P102]->(title:E35),
				(image)-[:P48]->(identifier:E42),
				(image)<-[:P94]-(e65:E65)
			OPTIONAL MATCH (e65)-[:P14]->(:E21)-[:P131]->(author:E82)
			OPTIONAL MATCH (e65)-[:P4]->(:E52)-[:P82]->(date:E61)
			OPTIONAL MATCH (image)-[:P105]->(:E40)-[:P131]->(owner:E82)
			OPTIONAL MATCH (image)-[:P3]->(desc:E62)-[:P3_1]->(:E55 {id: "image_description"})
			OPTIONAL MATCH (image)-[:P3]->(misc:E62)-[:P3_1]->(:E55 {id: "image_miscellaneous"})
			OPTIONAL MATCH (image)-[:has_tag]->(tag:TAG)
			WITH image, file, title, identifier, author, date, owner, desc, misc, collect(tag.id) AS tags `;

		if (term) {
			term.forEach(function (string, index) {
				if (index === 0)
					q += 'WHERE (';
				else
					q += 'AND (';

				q += 'title.value =~ $regexTitle[' + index + '] ';
				q += 'OR author.value =~ $regexAuthor[' + index + '] ';
				q += 'OR owner.value =~ $regexOwner[' + index + '] ';
				q += 'OR any(tag IN tags WHERE tag =~ $regexTag[' + index + ']) ';

				q += ') ';

				regexTitle.push('(?i).*' + string + '.*');
				regexAuthor.push('(?i).*' + string + '.*');
				regexOwner.push('(?i).*' + string + '.*');
				regexTag.push('(?i).*' + string + '.*');
			});
		}
	
		q += `RETURN image.id AS id,
				file,
				title.value AS title,
				identifier.permalink AS permalink,
				author.value AS author,
				date.value AS date,
				owner.value AS owner,
				desc.value AS description,
				misc.value AS misc,
				tags`;
			// LIMIT 20`;

		let params = {
			regexTitle: regexTitle,
			regexAuthor: regexAuthor,
			regexOwner: regexOwner,
			regexTag: regexTag
		};

		neo4j.readTransaction(q, params)
			.then(function (results) {
				res.json(results);
			})
			.catch(function (err) {
				utils.error.neo4j(res, err, '#image.query');
			});

	},

	get: function (req, res) {

		let q = `
			MATCH (image:E38:UH4D {id: $id})-[:P106]->(file:D9),
				(image)-[:P102]->(title:E35),
				(image)-[:P48]->(identifier:E42),
				(image)<-[:P94]-(e65:E65)
			OPTIONAL MATCH (e65)-[:P14]->(:E21)-[:P131]->(author:E82)
			OPTIONAL MATCH (e65)-[:P4]->(:E52)-[:P82]->(date:E61)
			OPTIONAL MATCH (image)-[:P105]->(:E40)-[:P131]->(owner:E82)
			OPTIONAL MATCH (image)-[:P3]->(desc:E62)-[:P3_1]->(:E55 {id: "image_description"})
			OPTIONAL MATCH (image)-[:P3]->(misc:E62)-[:P3_1]->(:E55 {id: "image_miscellaneous"})
			OPTIONAL MATCH (image)-[:has_tag]->(tag:TAG)
	
			RETURN image.id AS id,
				file,
				title.value AS title,
				identifier.permalink AS permalink,
				author.value AS author,
				date.value AS date,
				owner.value AS owner,
				desc.value AS description,
				misc.value AS misc,
				collect(tag.id) AS tags`;

		let params = {
			id: req.params.id
		};

		neo4j.readTransaction(q, params)
			.then(function (results) {
				res.json(results[0]);
			})
			.catch(function (err) {
				utils.error.neo4j(res, err, '#image.get');
			});

	}

};
