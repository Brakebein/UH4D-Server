// 1. merge nodes that refer to the same author or owner
MATCH (n1:E82)<-[:P131]-(m1), (n2:E82)<-[:P131]-(m2)
WHERE n1.value = n2.value
WITH n1, m1, n2, m2
CALL apoc.when(size(n1.id) > size(n2.id),
  "RETURN n1 AS nKeep, n2 AS nDel, [m1, m2] AS mNodes",
  "RETURN n2 AS nKeep, n1 AS nDel, [m2, m1] AS mNodes",
  {n1:n1, n2:n2, m1:m1, m2:m2}) YIELD value
WITH DISTINCT value.nKeep AS nKeep, value.nDel AS nDel, value.mNodes AS mNodes
CALL apoc.refactor.mergeNodes(mNodes, {properties: 'discard'}) YIELD node
RETURN node, nKeep

// 2. remove double E82
MATCH (m)-[:P131]->(n)
WITH m, collect(n) AS nodes
  WHERE size(nodes) > 1
CALL apoc.when(size(nodes[0].id) < size(nodes[1].id), "RETURN n1 AS nDel", "RETURN n2 AS nDel", {n1: nodes[0], n2: nodes[1]}) YIELD value
DETACH DELETE value.nDel