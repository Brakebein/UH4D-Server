// insert model
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

RETURN DISTINCT dobj, file, collect(mat) AS materials;

// query models
MATCH (event:D7:UH4D {id: "d7_Hy0RgTjMf"})-[:L11]->(dobj:D1)-[:P106]->(file:D9)
OPTIONAL MATCH (dobj)-[rmat:P2]->(mat:E57)
WITH event, dobj, file, mat
ORDER BY rmat.order
WITH event, dobj, file, collect(mat) AS materials
OPTIONAL MATCH (dobj)<-[:P106]-(parent:D1)
RETURN dobj.id AS id,
       event.id AS eventId,
       dobj AS obj,
       file AS file,
       materials,
       parent.id AS parent;