const request = require('request-promise');
const config = require('../../config');
const fs = require('fs-extra');

async function requestImage(url) {

  const tmpFile = config.path.tmp + '/' + url.slice(url.lastIndexOf('/') + 1);

  console.debug(url);

  try {
    // http request
    const response = await request(url, {encoding: 'binary'});

    // save data to file
    await fs.writeFile(tmpFile, response, 'binary');

    return tmpFile;
  } catch (err) {
    throw err;
  }

}

async function requestDetailsPage(id) {

  const url = 'http://www.deutschefotothek.de/documents/obj/' + id;
  const tmpFile = config.path.tmp + '/' + id + '.html';

  console.debug(url);

  try {
    // http request
    const response = await request(url, {
      encoding: null,
      headers: {
        'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    // prepare html
    let htmlString = response.toString('latin1');
    htmlString = htmlString.replace(/<script><img.*<\/script>/g, '');
    htmlString = htmlString.replace(/&quot([^;])/g, '&quot;$1');

    // save data to file
    await fs.writeFile(tmpFile, htmlString, {encoding: 'latin1'});

    return tmpFile;
  } catch (err) {
    throw err;
  }

}

async function searchByFile(file) {

  const baseFilename = file.substr(0, file.lastIndexOf('.'));
  const url = 'http://www.deutschefotothek.de/ete?action=query&refine=Suchen&desc=' + baseFilename;

  try {
    // request search page
    const response = await request(url);

    // parse permalink
    const pattern = /<p class="description">\s*<a\shref="([^"]*)"/;
    const matches = pattern.exec(response);
    console.debug(matches[1]);

    return matches[1];
  } catch (err) {
    throw err;
  }

}

module.exports = {
  requestImage,
  requestDetailsPage,
  searchByFile
};
