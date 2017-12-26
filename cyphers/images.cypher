// insert into database
MATCH (tdesc:E55:UH4D {id: "image_description"}), (tmisc:E55:UH4D {id: "image_miscellaneous"})
CREATE (image:E38:UH4D {id: $imageId}),
       (image)-[:P102]->(title:E35:UH4D $title),
       (image)-[:P106]->(file:D9:UH4D $file),
       (image)-[:P48]->(identifier:E42:UH4D $identifier),
       (image)<-[:P94]-(e65:E65:UH4D {id: $e65id})

MERGE (author:E21:UH4D)-[:P131]->(authorName:E82:UH4D {value: $author.value})
ON CREATE SET author.id = $authorId, authorName.id = $author.id
CREATE (e65)-[:P14]->(author)

CREATE (e65)-[:P4]->(:E52:UH4D {id: $e52id})-[:P82]->(date:E61:UH4D {value: $date})

MERGE (owner:E40:UH4D)-[:P131]->(ownerName:E82:UH4D {value: $owner.value})
ON CREATE SET owner.id = $ownerId, ownerName.id = $owner.id
CREATE (image)-[:P105]->(owner)

CREATE (image)-[:P3]->(desc:E62:UH4D $desc)-[:P3_1]->(tdesc)

CREATE (image)-[:P3]->(misc:E62:UH4D $misc)-[:P3_1]->(tmisc)

FOREACH (tag IN $tags |
  MERGE (t:TAG:UH4D {id: tag})
  MERGE (image)-[:has_tag]->(t)
)

RETURN image;

// query images
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

RETURN image.id AS id,
       file,
       title.value AS title,
       identifier.permalink AS permalink,
       author.value AS author,
       date.value AS date,
       owner.value AS owner,
       desc.value AS description,
       misc.value AS misc,
       spatial,
       collect(tag.id) AS tags
LIMIT 20;

// search images
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

WITH image, file, title, identifier, author, date, owner, desc, misc, tag
WHERE title.value =~ $titleRegex
OR author.value =~ $titleRegex

RETURN image.id AS id,
       file,
       title.value AS title,
       identifier.permalink AS permalink,
       author.value AS author,
       date.value AS date,
       owner.value AS owner,
       desc.value AS description,
       misc.value AS misc,
       spatial,
       collect(tag.id) AS tags
LIMIT 20;
