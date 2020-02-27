const utils = require('../modules/utils');
const neo4j = require('../modules/neo4j-request');
const Promise = require('bluebird');
const shortid = require('shortid');
const parseDate = require('../modules/parseDate');

module.exports = {

	query: function (req, res) {
		// console.log(req.query);

		let term = req.query.query ? req.query.query.split(/\s+/) : [];
		let objIncl = req.query.filterObjIncl || [];
		let objExcl = req.query.filterObjExcl || [];

		if (!Array.isArray(objIncl)) objIncl = [objIncl];
		if (!Array.isArray(objExcl)) objExcl = [objExcl];

		// console.log(objIncl);
		// console.log(objExcl);

		if (term.indexOf('dummy:show') === -1) {
			if (term.indexOf('dummy:hide') === -1)
				term.push('dummy:hide');
		}
		else {
			term.splice(term.indexOf('dummy:show'), 1);
		}

		let capNo = [],
			regexTitle = [],
			regexAuthor = [],
			regexOwner = [],
			regexDate = [],
			regexTag = [];

		let q = `
			MATCH (image:E38:UH4D)`;

		if (req.query.from && req.query.to)
			q += `
				OPTIONAL MATCH (image)<-[:P94]-(e65:E65)-[:P4]->(:E52)-[:P82]->(date:E61)
				WITH image, date
				WHERE date ${req.query.undated === 'true' ? 'IS NULL OR' : 'IS NOT NULL AND'} date.to > date($from) AND date.from < date($to)`;

		if (objIncl.length || objExcl.length)
			q += `
				CALL apoc.path.expandConfig(image, {relationShipFilter: "P138>|link", labelFilter: "E22", minLevel: 1}) YIELD path
				WITH image, last(nodes(path)) AS e22
				MATCH (e22)<-[:P67]-(dobj:D1)
				WHERE dobj.id IN $includes AND NOT dobj.id IN $excludes`;

		q += `
			WITH image
			MATCH (image)-[:P106]->(file:D9),
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
			OPTIONAL MATCH (image)<-[:P41]-(e17:E17)-[:P42]->(:E55 {id: "meta_check"}),
										 (e17)-[:P14]->(checkUser:E21),
										 (e17)-[:P4]->(:E52)-[:P82]->(checkDate:E61)
			WITH image, file, title, identifier, author, date, owner, desc, misc, spatial, collect(tag.id) AS tags,
					 CASE WHEN e17 IS NOT NULL THEN {user: checkUser.id, from: toString(checkDate.from), to: toString(checkDate.to)} ELSE NULL END AS checked `;

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
				else if (string === 'dummy:hide')
					q += 'NOT image.id =~ ".*_dummy"';
				else {
					q += 'identifier.slub_cap_no = $capNo[' + index + '] ';
					q += 'OR title.value =~ $regexTitle[' + index + '] ';
					q += 'OR author.value =~ $regexAuthor[' + index + '] ';
					q += 'OR owner.value =~ $regexOwner[' + index + '] ';
					// q += 'OR date.value =~ $regexDate[' + index + '] ';
					q += 'OR any(tag IN tags WHERE tag =~ $regexTag[' + index + ']) ';
				}

				q += ') ';

				capNo.push(string);
				regexTitle.push('(?i).*' + string + '.*');
				regexAuthor.push('(?i).*' + string + '.*');
				regexOwner.push('(?i).*' + string + '.*');
				// regexDate.push('(?i).*' + string + '.*');
				regexTag.push('(?i).*' + string + '.*');
			});
		}
	
		q += `RETURN image.id AS id,
				file,
				title.value AS title,
				identifier.permalink AS permalink,
				identifier.slub_cap_no AS captureNumber,
				author.value AS author,
				date {.*, from: toString(date.from), to: toString(date.to)} AS date,
				owner.value AS owner,
				desc.value AS description,
				misc.value AS misc,
				spatial,
				tags,
				checked`;
			// LIMIT 20`;

		let params = {
			from: req.query.from,
			to: req.query.to,
			capNo: capNo,
			regexTitle: regexTitle,
			regexAuthor: regexAuthor,
			regexOwner: regexOwner,
			regexDate: regexDate,
			regexTag: regexTag,
			includes: objIncl,
			excludes: objExcl
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

		// language=Cypher
		const q = `
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
			OPTIONAL MATCH (image)<-[:P41]-(e17:E17)-[:P42]->(:E55 {id: "meta_check"}),
										 (e17)-[:P14]->(checkUser:E21),
										 (e17)-[:P4]->(:E52)-[:P82]->(checkDate:E61)
	
			RETURN image.id AS id,
				file,
				title.value AS title,
				identifier.permalink AS permalink,
				identifier.slub_cap_no AS captureNumber,
				author.value AS author,
				date {.*, from: toString(date.from), to: toString(date.to)} AS date,
				owner.value AS owner,
				desc.value AS description,
				misc.value AS misc,
				spatial,
				collect(tag.id) AS tags,
				CASE WHEN e17 IS NOT NULL THEN {user: checkUser.id, from: toString(checkDate.from), to: toString(checkDate.to)} ELSE NULL END AS checked`;

		const params = {
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

	update: function (req, res) {

		const id = shortid.generate();

		let q = `MATCH (image:E38:UH4D {id: $id})<-[:P94]-(e65:E65) `;
		let params = {
			id: req.params.id
		};

		switch (req.query.prop) {
			case 'title':
				q += `MATCH (image)-[:P102]->(title:E35)
					SET title.value = $title`;
				params.title = req.body.title;
				break;

			case 'date':
				let date = parseDate(req.body.date.value);
				q += `
					MERGE(e65)-[:P4]->(e52:E52:UH4D)-[:P82]->(date:E61:UH4D)
						ON CREATE SET e52.id = $e52id
					SET date.value = $date.value`;
				if (date) {
					req.body.date = date;
					q += `,
						date.from = date($date.from),
						date.to = date($date.to),
						date.display = $date.display`;
				}
				params.date = req.body.date;
				params.e52id = 'e52_' + id;
				break;

			case 'author':
				q += `OPTIONAL MATCH (e65)-[r14:P14]->(:E21)-[:P131]->(:E82)`;
				if (req.body.author.length)
					q += `
					MERGE (e21:E21:UH4D)-[:P131]->(e82:E82:UH4D {value: $name})
						ON CREATE SET e21.id = $e21id, e82.id = $e82id
					CREATE (e65)-[:P14]->(e21)`;
				q += ` DELETE r14`;
				params.name = req.body.author;
				params.e21id = 'e21_' + id + '_' + utils.replace(req.body.author);
				params.e82id = 'e82_' + id + '_' + utils.replace(req.body.author);
				break;

			case 'owner':
				q += `OPTIONAL MATCH (image)-[r105:P105]->(:E40)-[:P131]->(:E82)`;
				if (req.body.owner.length)
					q += `
					MERGE (e40:E40:UH4D)-[:P131]->(e82:E82:UH4D {value: $owner})
						ON CREATE SET e40.id = $e40id, e82.id = $e82id
					CREATE (image)-[:P105]->(e40)`;
				q += ' DELETE r105';
				params.owner = req.body.owner;
				params.e40id = 'e40_' + id + '_' + utils.replace(req.body.owner);
				params.e82id = 'e82_' + id + '_' + utils.replace(req.body.owner);
				break;

			case 'captureNumber':
				q += `MATCH (image)-[:P48]->(identifier:E42)
					SET identifier.slub_cap_no = $captureNumber`;
				params.captureNumber =  req.body.captureNumber;
				break;

			case 'description':
				q += `MATCH (tdesc:E55:UH4D {id: "image_description"}) `;
				if (req.body.description.length)
					q += `
					MERGE (image)-[:P3]->(desc:E62:UH4D)-[:P3_1]->(tdesc)
						ON CREATE SET desc.id = $descId, desc.value = $desc
						ON MATCH SET desc.value = $desc`;
				else
					q += `OPTIONAL MATCH (image)-[:P3]->(desc:E62)-[:P3_1]->(tdesc)
						DETACH DELETE desc`;
				params.desc = req.body.description;
				params.descId = 'e62_desc_' + id;
				break;

			case 'misc':
				q += `MATCH (tmisc:E55:UH4D {id: "image_miscellaneous"}) `;
				if (req.body.misc.length)
					q += `
					MERGE (image)-[:P3]->(misc:E62:UH4D)-[:P3_1]->(tmisc)
						ON CREATE SET misc.id = $miscId, misc.value = $misc
						ON MATCH SET misc.value = $misc`;
				else
					q += `OPTIONAL MATCH (image)-[:P3]->(misc:E62)-[:P3_1]->(tmisc)
						DETACH DELETE misc`;
				params.misc = req.body.misc;
				params.miscId = 'e62_misc_' + id;
				break;

			case 'tags':
				q += `OPTIONAL MATCH (image)-[rtag:has_tag]->(:TAG)
					DELETE rtag
					WITH image
					FOREACH (tag IN $tags |
						MERGE (t:TAG:UH4D {id: tag})
						MERGE (image)-[:has_tag]->(t)
					)`;
				params.tags = req.body.tags || [];
				break;

			case 'checked':
				q += `MATCH (check:E55:UH4D {id: "meta_check"})
					OPTIONAL MATCH (image)<-[:P41]-(:E17)-[ruser:P14]->(:E21)
					MERGE (image)<-[:P41]-(e17:E17:UH4D)-[:P42]->(check)
						ON CREATE SET e17.id = $e17id
					MERGE (user:E21:UH4D {id: $checked.user})
					CREATE (e17)-[:P14]->(user)
					MERGE (e17)-[:P4]->(e52:E52:UH4D)-[:P82]->(date:E61:UH4D)
						ON CREATE SET e52.id = $e52id
					SET date.from = datetime($checked.from),
							date.to = datetime($checked.to)
					DELETE ruser`;
				params.e17id = 'e17_checked_' + id;
				params.e52id = 'e52_checked_' + id;
				params.checked = req.body.checked;
		}

		q += ` RETURN image`;

		neo4j.readTransaction(q, params)
			.then(function () {
				res.json(req.body)
			})
			.catch(function (err) {
				utils.error.neo4j(res, err, 'image.update');
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
				const q = `
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
	},

	setLinksToObjects: function (req, res) {

		const q = `
			MATCH (image:E38:UH4D {id: $imageId})
			OPTIONAL MATCH (image)-[r:P138]->(e22:E22)
			DELETE r
			WITH image
			MATCH (obj:D1:UH4D)-[:P67]->(e22:E22)
			WHERE obj.id IN $objIds
			MERGE (image)-[:P138]->(e22)`;

		const params = {
			imageId: req.params.id,
			objIds: Array.isArray(req.query.objectIds) ? req.query.objectIds : [req.query.objectIds]
		};

		neo4j.writeTransaction(q, params)
			.then(function () {
				let result = req.body;
				res.json(result);
			})
			.catch(function (err) {
				utils.error.neo4j(res, err, '#image.setLinksToObjects');
			});

	},
	
	createDummy: function (req, res) {

		let q = `
			CREATE (image:E38:UH4D {id: $imageId}),
				(image)-[:P102]->(title:E35:UH4D $title),
				(image)-[:P106]->(file:D9:UH4D $file),
				(image)-[:P48]->(identifier:E42:UH4D $identifier),
				(image)<-[:P94]-(e65:E65:UH4D {id: $e65id}),
				(image)-[:has_spatial]->(spatial:Spatial:UH4D $spatial)
				
			RETURN image.id AS id,
				file,
				title.value AS title,
				identifier.permalink AS permalink,
				NULL AS captureNumber,
				NULL AS author,
				NULL AS date,
				NULL AS owner,
				NULL AS description,
				NULL AS misc,
				spatial,
				[] AS tags`;

		let id = shortid.generate() + '_dummy';

		let params = {
			imageId: id,
			title: {
				id: 'e35_' + id,
				value: 'Dummy Image'
			},
			identifier: {
				id: 'e42_' + id,
				permalink: 'https://de.wikipedia.org/wiki/Dummy'
			},
			file: {
				id: 'd9_' + id,
				path: '',
				original: 'white.jpg',
				preview: 'white.jpg',
				thumb: 'white.jpg',
				type: 'jpg',
				width: req.body.width,
				height: req.body.height
			},
			e65id: 'e65_' + id,
			spatial: {
				id: 'spatial_' + id,
				matrix: req.body.matrix,
				offset: req.body.offset,
				ck: req.body.ck
			}
		};

		neo4j.writeTransaction(q, params)
			.then(function (results) {
				res.json(results[0]);
			})
			.catch(function (err) {
				utils.error.neo4j(res, err, '#image.createDummy');
			});
	},

	deleteDummy: function (req, res) {

		let q = `
			MATCH (image:E38:UH4D {id: $imageId}),
				(image)-[:P102]->(title:E35),
				(image)-[:P106]->(file:D9),
				(image)-[:P48]->(identifier:E42),
				(image)<-[:P94]-(e65:E65),
				(image)-[:has_spatial]->(spatial:Spatial)
			WHERE image.id =~ ".*_dummy"
			DETACH DELETE image, title, file, identifier, e65, spatial`;

		let params = {
			imageId: req.params.id
		};

		neo4j.writeTransaction(q, params)
			.then(function () {
				res.json({
					message: `Dummy image "${req.params}" has been deleted.`
				});
			})
			.catch(function (err) {
				utils.error.neo4j(res, err, '#image.deleteDummy');
			});
	},
	
	getDateExtent: function (req, res) {

		// language=Cypher
		let q = `
			MATCH (image:E38:UH4D)<-[:P94]-(e65:E65)-[:P4]->(:E52)-[:P82]->(date:E61)
			WHERE exists(date.from)
			RETURN toString(date.from) AS d
			ORDER BY d
			LIMIT 1
			UNION
			MATCH (image:E38:UH4D)<-[:P94]-(e65:E65)-[:P4]->(:E52)-[:P82]->(date:E61)
			WHERE exists(date.to)
			RETURN toString(date.to) AS d
			ORDER BY d DESC
			LIMIT 1`;

		neo4j.readTransaction(q)
			.then(function (results) {
				res.json({
					from: results[0].d,
					to: results[1].d
				});
			})
			.catch(function (err) {
				utils.error.neo4j(res, err, '#image.getDateExtent');
			});

	}

};
