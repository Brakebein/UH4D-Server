const config = require('./config');
const express = require('express');
const bodyParser = require('body-parser');
const compression = require('compression');
const log4js = require('log4js');

// logger
log4js.configure({
	appenders: {
		out: { type: 'console' },
		logfile: {
			type: 'file',
			filename: 'logs/server.log'
		}
	},
	categories: {
		default: { appenders: ['out', 'logfile'], level: 'all' }
	}
});
const logger = log4js.getLogger('UH4D');
console.log = logger.info.bind(logger);
console.debug = logger.debug.bind(logger);
console.warn = logger.warn.bind(logger);
console.error = logger.error.bind(logger);


const app = express();

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(compression());

app.all('/*', function (req, res, next) {
	// CORS headers
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
	// set custom headers for CORS
	res.header('Access-Control-Allow-Headers', 'Content-type,Accept,X-Access-Token,X-Key');

	if (req.method === 'OPTIONS') {
		res.status(200).end();
	}
	else {
		next();
	}
});

app.use('/api', require('./routes'));
app.use('/data', express.static(config.path.data));

// if no route is matched by now, it must be 404
app.use(function (req, res) {
	res.status(404);
	res.json({
		message: 'Not fount #1'
	});
});

// start server
app.set('port', process.env.PORT || 3001);

const server = app.listen(app.get('port'), function () {
	console.log('Express server listening on port ' + server.address().port);
});
server.timeout = 600000; // 10 minutes


// shutdown routine
process.on('exit', function () {
	console.log('Shutdown...');
	server.close();
	log4js.shutdown();
});

// catch ctrl+c event and exit properly
process.on('SIGINT', function () {
	process.exit();
});

// catch uncaught exception and exit properly
process.on('uncaughtException', function (err) {
	console.error('Uncaught Exception', err);
	process.exit();
});
