// create linkage
MATCH (image:E38:UH4D {id: $imageId}), (obj:D1:UH4D)
WHERE obj.id IN $objIds
MERGE (obj)-[:P67]->(e22:E22:UH4D {id: "e22_" + obj.id})
MERGE (image)-[:P138]->(e22)