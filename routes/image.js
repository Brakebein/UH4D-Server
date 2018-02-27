const utils = require('../modules/utils');
const neo4j = require('../modules/neo4j-request');
const Promise = require('bluebird');

module.exports = {

	query: function (req, res) {
		//console.log(req.query);

		let term = req.query.query ? req.query.query.split(/\s+/) : false;
		//console.log(term);

		let capNo = [],
			regexTitle = [],
			regexAuthor = [],
			regexOwner = [],
			regexDate = [],
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
			OPTIONAL MATCH (image)-[:has_spatial]->(spatial:Spatial)
			OPTIONAL MATCH (image)-[:has_tag]->(tag:TAG)
			WITH image, file, title, identifier, author, date, owner, desc, misc, spatial, collect(tag.id) AS tags `;

		if (term) {
			term.forEach(function (string, index) {
				if (index === 0)
					q += 'WHERE (';
				else
					q += 'AND (';

				if (string === 'spatial:set')
					q += 'spatial IS NOT NULL';
				else if (string === 'spatial:unset')
					q += 'spatial IS NULL';
				else {
					q += 'identifier.slub_cap_no = $capNo[' + index + '] ';
					q += 'OR title.value =~ $regexTitle[' + index + '] ';
					q += 'OR author.value =~ $regexAuthor[' + index + '] ';
					q += 'OR owner.value =~ $regexOwner[' + index + '] ';
					q += 'OR date.value =~ $regexDate[' + index + '] ';
					q += 'OR any(tag IN tags WHERE tag =~ $regexTag[' + index + ']) ';
				}

				q += ') ';

				capNo.push(string);
				regexTitle.push('(?i).*' + string + '.*');
				regexAuthor.push('(?i).*' + string + '.*');
				regexOwner.push('(?i).*' + string + '.*');
				regexDate.push('(?i).*' + string + '.*');
				regexTag.push('(?i).*' + string + '.*');
			});
		}
	
		q += `RETURN image.id AS id,
				file,
				title.value AS title,
				identifier.permalink AS permalink,
				identifier.slub_cap_no AS captureNumber,
				author.value AS author,
				date.value AS date,
				owner.value AS owner,
				desc.value AS description,
				misc.value AS misc,
				spatial,
				tags`;
			// LIMIT 20`;

		let params = {
			capNo: capNo,
			regexTitle: regexTitle,
			regexAuthor: regexAuthor,
			regexOwner: regexOwner,
			regexDate: regexDate,
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
			OPTIONAL MATCH (image)-[:has_spatial]->(spatial:Spatial)
			OPTIONAL MATCH (image)-[:has_tag]->(tag:TAG)
	
			RETURN image.id AS id,
				file,
				title.value AS title,
				identifier.permalink AS permalink,
				identifier.slub_cap_no AS captureNumber,
				author.value AS author,
				date.value AS date,
				owner.value AS owner,
				desc.value AS description,
				misc.value AS misc,
				spatial,
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

	},

	setSpatial: function (req, res) {
		let promise;

		if (req.query.method === 'manual') {
			console.debug('manual method');

			if (!req.body.spatialize || !req.body.spatialize.matrix || !req.body.spatialize.offset || !req.body.spatialize.ck) {
				utils.abort.missingData(res, '#image.setSpatial spatialize');
				return;
			}

			promise = Promise.resolve({
				id: req.params.id,
				spatial: {
					id: 'spatial_' + req.params.id,
					matrix: req.body.spatialize.matrix,
					offset: req.body.spatialize.offset,
					ck: req.body.spatialize.ck
				}
			});
		}
		else {
			utils.error.general(res, '#image.setSpatial: No method selected');
			return;
		}

		promise
			.then(function (params) {
				let q = `
					MATCH (image:E38:UH4D {id: $id})
					MERGE (spatial:Spatial:UH4D {id: $spatial.id})
					SET spatial = $spatial
					MERGE (image)-[:has_spatial]->(spatial)
					RETURN spatial`;

				return neo4j.writeTransaction(q, params);
			})
			.then(function (results) {
				let result = req.body;
				result.spatial = results[0].spatial;
				delete result.spatialize;
				res.json(result);
			})
			.catch(function (err) {
				utils.error.neo4j(res, err, '#image.setSpatial');
			});
	}

};
