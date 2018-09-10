// create linkage, remove old first (update)
MATCH (image:E38:UH4D {id: $imageId})
OPTIONAL MATCH (image)-[r:P138]->(e22:E22)
DELETE r
WITH image
MATCH (obj:D1:UH4D)
WHERE obj.id IN $objIds
MERGE (obj)-[:P67]->(e22:E22:UH4D {id: "e22_" + obj.id})
MERGE (image)-[:P138]->(e22)