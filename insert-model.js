const utils = require('./modules/utils');
const fs = require('fs-extra-promise');
const shortid = require('shortid');
const uuid = require('uuid/v4');
const neo4j = require('./modules/neo4j-request');

let file = process.argv[2];
let shortPath = 'models/' + uuid() + '/';

fs.readFileAsync(file)
.then(function (string) {
	let json = JSON.parse(string);

	let statements = [];

	let id = shortid.generate();
	let eventId = 'd7_' + id;

	// create event
	statements.push({
		statement: 'CREATE (event:D7:UH4D {id: $eventId}) RETURN event',
		parameters: {
			eventId: eventId
		}
	});

	// create objects
	json.data.forEach(function (d) {
		let q = `
			MATCH (event:D7:UH4D {id: $eventId})

			MERGE (dobj:D1:UH4D {id: $dobj.id})
			ON CREATE SET dobj = $dobj
			
			MERGE (file:D9:UH4D {id: $file.id})
			ON CREATE SET file = $file
			CREATE (event)-[:L11]->(dobj),
				   (dobj)-[:P106]->(file)
		
			FOREACH (parentId IN $parentId |
				MERGE (parent:D1:UH4D {id: parentId})
				CREATE (parent)-[:P106]->(dobj)
			)
			
			WITH dobj, file

			UNWIND range(0, size($materials) - 1) AS i
			MERGE (mat:E57:UH4D {id: $materials[i].id})
			ON CREATE SET mat = $materials[i]
			CREATE (dobj)-[:P2 {order: i}]->(mat)
			
			RETURN DISTINCT dobj, file, collect(mat) AS materials`;

		let params = {
			eventId: eventId,
			parentId: d.parent ? ['d1_' + id + '_' + utils.replace(d.parent)] : [],
			dobj: {
				id: 'd1_' + id + '_' + utils.replace(d.obj.id),
				name: d.obj.name,
				nodeId: d.obj.id,
				matrix: d.obj.matrix,
				type: d.obj.type,
				unit: d.obj.unit,
				up: d.obj.upAxis.replace('_UP', '')
			},
			file: {
				id: 'd9_' + id + '_' + utils.replace(d.obj.id),
				path: shortPath,
				mesh: d.file.content,
				edges: d.file.edges,
				geometryId: d.file.geometryId,
				type: d.file.type
			},
			materials: []
		};

		if (d.material) {
			let mat = {
				id: 'e57_' + id + '_' + utils.replace(d.material.id),
				name: d.material.name,
				materialId: d.material.id,
				path: shortPath + 'maps/',
				diffuse: d.material.diffuse
			};
			if (d.material.alpha)
				mat.alpha = d.material.alpha;

			params.materials.push(mat);
		}

		statements.push({
			statement: q,
			parameters: params
		});
	});

	neo4j.multipleStatements(statements)
		.then(function (results) {
			console.log(results[0]);
			console.log(results[1]);
			process.exit();
		})
		.catch(function (err) {
			console.error(err);
			process.exit();
		});
});
