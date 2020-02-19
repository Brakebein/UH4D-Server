const neo4j = require('../../modules/neo4j-request');
const shortId = require('shortid');
const utils = require('../../modules/utils');
const parseDate = require('../../modules/parseDate');

async function checkDatabaseEntry(slubId) {

  // language=Cypher
  const q = `
    MATCH (image:E38:UH4D)-[:P48]->(:E42:UH4D {slub_id: $slubId})
    RETURN image`;

  const params = {
    slubId
  };

  try {
    const results = await neo4j.readTransaction(q, params);
    return !!results[0];
  } catch (err) {
    throw err;
  }

}

async function writeToDatabase(data) {

  const date = parseDate(data.date);

  let q = `
		MATCH (tdesc:E55:UH4D {id: "image_description"}), (tmisc:E55:UH4D {id: "image_miscellaneous"})
		CREATE (image:E38:UH4D {id: $imageId}),
			(image)-[:P102]->(title:E35:UH4D $title),
			(image)-[:P106]->(file:D9:UH4D $file),
			(image)-[:P48]->(identifier:E42:UH4D $identifier),
			(image)<-[:P94]-(e65:E65:UH4D {id: $e65id}) `;

  if (data.author)
    q += `MERGE (author:E21:UH4D)-[:P131]->(authorName:E82:UH4D {value: $author.value})
			ON CREATE SET author.id = $authorId, authorName.id = $author.id
		CREATE (e65)-[:P14]->(author) `;

  if (date)
    q += `CREATE (e65)-[:P4]->(:E52:UH4D {id: $e52id})-[:P82]->(date:E61:UH4D {value: $date.value, from: date($date.from), to: date($date.to), display: $date.display}) `;

  if (data.owner)
    q += `MERGE (owner:E40:UH4D)-[:P131]->(ownerName:E82:UH4D {value: $owner.value})
			ON CREATE SET owner.id = $ownerId, ownerName.id = $owner.id
		CREATE (image)-[:P105]->(owner) `;

  if (data.description)
    q += `CREATE (image)-[:P3]->(desc:E62:UH4D $desc)-[:P3_1]->(tdesc) `;

  if (data.misc.length)
    q += `CREATE (image)-[:P3]->(:E62:UH4D $misc)-[:P3_1]->(tmisc) `;

  q += `FOREACH (tag IN $tags |
			MERGE (t:TAG:UH4D {id: tag})
			MERGE (image)-[:has_tag]->(t)
		)
		
		RETURN image`;

  const id = shortId.generate() + '_' + data.file.original;
  const authorId = shortId.generate() + '_' + utils.replace(data.author);
  const ownerId = shortId.generate() + '_' + utils.replace(data.owner);

  const params = {
    imageId: id,
    title: {
      id: 'e35_' + id,
      value: data.title
    },
    identifier: {
      id: 'e42_' + id,
      permalink: data.permalink,
      slub_id: data.id,
      slub_cap_no: data.captureNo
    },
    file: Object.assign({ id: 'd9_' + id }, data.file),
    e65id: 'e65_' + id,
    e52id: 'e52_' + id,
    date: date,
    author: {
      id: 'e82_' + authorId,
      value: data.author
    },
    authorId: 'e21_' + authorId,
    owner: {
      id: 'e82_' + ownerId,
      value: data.owner
    },
    ownerId: 'e40_' + ownerId,
    desc: {
      id: 'e62_desc_' + id,
      value: data.description
    } ,
    misc: {
      id: 'e62_misc_' + id,
      value: data.misc.join(', ')
    },
    tags: data.tags || []
  };

  try {
    const results = await neo4j.writeTransaction(q, params);
    // reject if nothing created
    if (!results[0]) {
      return Promise.reject();
    }
  } catch (err) {
    throw err;
  }

}

module.exports = {
  checkDatabaseEntry,
  writeToDatabase
};
