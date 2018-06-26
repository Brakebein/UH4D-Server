const config = require('../config');
const Promise = require('bluebird');
const neo4j = require('neo4j-driver').v1;

const driver = neo4j.driver(config.neo4j.uriBolt, neo4j.auth.basic(config.neo4j.user, config.neo4j.password));

driver.onError = function (err) {
	console.error('Neo4j driver instantiation failed', err);
};

process.on('exit', function () {
	driver.close();
});


function readTransaction(query, params) {
	const session = driver.session();

	return session.readTransaction(function (tx) {

		return tx.run( query, params || {} );

	}).then(function (result) {

		session.close();
		return extractBoltRecords(result.records);

	}).catch(function (err) {

		session.close();
		return Promise.reject(err);

	});
}

function writeTransaction(query, params) {
	const session = driver.session();

	return session.writeTransaction(function (tx) {

		return tx.run( query, params || {} );

	}).then(function (result) {

		session.close();
		return extractBoltRecords(result.records);

	}).catch(function (err) {

		session.close();
		return Promise.reject(err);

	});
}

function multipleTransactions(statements) {
	const session = driver.session();
	const tx = session.beginTransaction();
	
	return Promise
		.mapSeries(statements, function (sm) {
			return tx.run(sm.statement, sm.parameters)
				.then(function (result) {
					return extractBoltRecords(result.records);
				})
				.catch(function (err) {
					return Promise.reject(err);
				});
		})
		.then(function (results) {
			return tx.commit().then(function () {
				session.close();
				return results;
			});
		})
		.catch(function (err) {
			tx.rollback().then(function () {
				session.close();
			});
			return Promise.reject(err);
		});
}

function extractBoltRecords (data) {
	if (!data) return [];
	if (!Array.isArray(data)) return data;

	return data.map(function (record) {
		const obj = record.toObject();
		for (let key in obj) {
			obj[key] = convertValues(obj[key]);
		}
		return obj;
	});
}

function convertValues(value) {
	// neo4j integers
	if (neo4j.isInt(value) && neo4j.integer.inSafeRange(value))
		return value.toInt();

	// neo4j Node object
	if (value instanceof neo4j.types.Node) {
		value = value.properties;
	}

	// recursive
	if (Array.isArray(value)) {
		return value.map(function (v) {
			return convertValues(v);
		});
	}
	if (typeof value === 'object') {
		for (let key in value) {
			value[key] = convertValues(value[key]);
		}
	}

	return value;
}


module.exports = {

	readTransaction: readTransaction,
	writeTransaction: writeTransaction,
	multipleStatements: multipleTransactions,

	extractBoltRecords: extractBoltRecords
	
};
