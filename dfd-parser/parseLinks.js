const fs = require('fs-extra');
const path = require('path');
const LineByLineReader = require('line-by-line');
const P = require('bluebird');
const log4js = require('log4js');
const config = require('../config');
const {processImage} = require("./modules/processImage");
const {parseHTMLFile} = require("./modules/parser");
const {requestDetailsPage, requestImage} = require("./modules/request-dfd");
const {checkDatabaseEntry, writeToDatabase} = require("./modules/database");

log4js.configure({
  appenders: {
    out: { type: 'console' }
  },
  categories: {
    default: { appenders: ['out'], level: 'all' }
  }
});
const logger = log4js.getLogger('DFD-Parser');
// log4js.replaceConsole(logger);
console.log = logger.info.bind(logger);
console.debug = logger.debug.bind(logger);
console.warn = logger.warn.bind(logger);
console.error = logger.error.bind(logger);

// getopt
const opt = require('node-getopt').create([
  ['h', 'help']
]).bindHelp(`
Usage: node parseLinks.js <FILE>...
`).parseSystem();

// show help of arguments are missing
if (opt.argv.length === 0) {
  opt.showHelp();
  process.exit(1);
}

// get all specified filenames
const filenames = [];

opt.argv.forEach(argv => {
  let sepIndex = argv.lastIndexOf('/');
  if (sepIndex < 0) {
    sepIndex = argv.lastIndexOf('\\');
  }
  if (sepIndex < 0) return;

  const folder = argv.substring(0, sepIndex);
  const fileRegex = new RegExp(argv.substring(sepIndex + 1));

  const files = fs.readdirSync(folder);
  files.forEach(file => {
    if (fileRegex.test(file) && path.extname(file) === '.txt') {
      filenames.push(folder + argv[sepIndex] + file);
    }
  });
});

init();

async function init() {

  try {
    // process all link files
    const lists = await P.mapSeries(filenames, (file) => readLinkFile(file));

    const ids = [].concat(...lists);

    // start workflow for each id
    await P.mapSeries(ids, (id, index, length) => {
      console.log('Process ' + index + ' / ' + length, id);
      return new Promise(async (resolve, reject) => {
        try {
          const result = await processWorkflow(id);
          if (result === 'exists') {
            // go to next one
            setTimeout(resolve, 20);
          } else {
            // wait 1 second and go to next one
            setTimeout(resolve, 1000);
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    console.log('Done!');
    process.exit();
  } catch (err) {
    if (err) {
      console.error(err);
    } else {
      console.error('Something failed!');
    }
    process.exit(1);
  }
}

function readLinkFile(file) {

  return new Promise((resolve, reject) => {

    const ids = [];
    const regexp = /http:\/\/www\.deutschefotothek\.de\/documents\/obj\/([^,.\s\/]+)/;

    const lr = new LineByLineReader(file);

    lr.on('error', err => {
      reject(err);
    });

    lr.on('line', line => {
      const matches = regexp.exec(line);
      if (matches && matches[1]) {
        ids.push(matches[1]);
      }
    });

    lr.on('end', () => {
      resolve(ids);
    });

  });

}

async function processWorkflow(id) {

  // check if image with id already exists
  const entryExists = await checkDatabaseEntry(id);

  if (entryExists) {
    console.debug('Already exists. Skip...');
    return 'exists';
  }

  const meta = {
    id: id,
    permalink: 'http://www.deutschefotothek.de/documents/obj/' + id
  };

  let htmlFile;
  let imageFile;

  try {
    // pipeline
    htmlFile = await requestDetailsPage(id);
    Object.assign(meta, await parseHTMLFile(htmlFile));

    // if no download link is available, skip this image
    if (!meta.fileLink) {
      console.warn('Missing download link. Skip...');
      return;
    }

    imageFile = await requestImage(meta.fileLink);
    meta.file = await processImage(imageFile);

    // console.debug(meta);
    await writeToDatabase(meta);

  } catch (err) {

    // cleanup on error
    if (meta.file && meta.file.path) {
      console.warn('Unlink ' + meta.file.path);
      await fs.remove(config.path.data + '/' + meta.file.path);
    }

    throw err;

  } finally {

    // cleanup
    if (htmlFile) {
      await fs.remove(htmlFile);
    }
    if (imageFile) {
      await fs.remove(imageFile);
    }

  }

}
