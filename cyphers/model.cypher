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
MATCH (event:D7:UH4D {id: 'd7_Hy0RgTjMf'})-[:L11]->(dobj:D1)-[:P106]->(file:D9)
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

// query models (new query)
MATCH (e22:E22:UH4D {id: $id})-[:P1]->(name:E41)
MATCH (e22)-[:P67|P106*1..]-(obj:D1)
MATCH (obj)<-[:L11]-(event:D7),
      (obj)-[:P106]->(file:D9)

OPTIONAL MATCH (e22)<-[:P108]-(:E12)-[:P4]->(:E52)-[:P82]->(from:E61)
OPTIONAL MATCH (e22)<-[:P13]-(:E6)-[:P4]->(:E52)-[:P82]->(to:E61)
WITH e22, event, obj, file, name, {from: toString(from.value), to: toString(to.value)} AS date

OPTIONAL MATCH (obj)-[rmat:P2]->(mat:E57)
WITH e22, event, obj, file, name, date, mat
  ORDER BY rmat.order
WITH e22, event, obj, file, name, date, collect(mat) AS materials
OPTIONAL MATCH (obj)<-[:P106]-(parent:D1)
RETURN e22.id AS id,
       name.value AS name,
       date,
       collect({id:        obj.id,
        eventId:   event.id,
        obj:       obj,
        file:      file,
        materials: materials,
        parent:    parent.id
       }) AS object;


// merge E22 and E41 node
MATCH (obj:D1:UH4D)
WHERE NOT (obj)<-[:P106]-(:D1)
MERGE (obj)-[:P67]->(e22:E22:UH4D)
ON CREATE SET e22.id = 'e22_' + obj.id
MERGE (e22)-[:P1]->(e41:E41:UH4D)
ON CREATE SET e41.id = 'e41_' + obj.id, e41.value = obj.name