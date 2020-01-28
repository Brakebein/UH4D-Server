const config = require('../config');
const Promise = require('bluebird');
const neo4j = require('neo4j-driver');

const driver = neo4j.driver(
	config.neo4j.url,
	neo4j.auth.basic(config.neo4j.user, config.neo4j.password),
	{ disableLosslessIntegers: true }
);

driver.verifyConnectivity()
	.then(serverInfo => {
		console.log('Neo4j Server: ', serverInfo);
	})
	.catch(reason => {
		console.error('Neo4j driver instantiation failed', reason);
	});

process.on('exit', async () => {
	await driver.close();
});


async function readTransaction(query, params = {}) {
	const session = driver.session({
		database: config.neo4j.database,
		defaultAccessMode: neo4j.session.READ
	});

	try {

		const result = await session.readTransaction(txc => txc.run( query, params ));
		return extractBoltRecords(result.records);

	} catch (err) {

		return Promise.reject(err);

	} finally {

		await session.close();

	}
}

async function writeTransaction(query, params = {}) {
	const session = driver.session({
		database: config.neo4j.database
	});

	try {

		const result = await session.writeTransaction(txc => txc.run( query, params ));
		return extractBoltRecords(result.records);

	} catch (err) {

		return Promise.reject(err);

	} finally {

		await session.close();

	}
}

async function multipleTransactions(statements) {
	const session = driver.session({
		database: config.neo4j.database
	});
	const txc = session.beginTransaction();

	try {

		const results = [];

		for (let s of statements) {
			const result = await txc.run(s.statement, s.parameters);
			results.push(extractBoltRecords(result.records));
		}

		await txc.commit();

		return results;

	} catch (err) {

		await txc.rollback();
		return Promise.reject(err);

	} finally {

		await session.close();

	}
}

function extractBoltRecords (data) {
	if (!data) return [];
	if (!Array.isArray(data)) return data;

	return data.map(record => {
		const obj = {};
		record.keys.forEach(key => {
			obj[key] = convertValues(record.get(key));
		});
		return obj;
	});
}

function convertValues(value) {
	// neo4j integers
	if (neo4j.isInt(value)) {
		if (neo4j.integer.inSafeRange(value))
			return value.toNumber();
		else
			return value.toString();
	}


	// neo4j Node object
	if (value instanceof neo4j.types.Node) {
		value = value.properties;
	}

	// recursive
	if (Array.isArray(value)) {
		return value.map(v => convertValues(v));
	}
	if (typeof value === 'object' && value !== null) {
		for (let key of Object.keys(value)) {
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
