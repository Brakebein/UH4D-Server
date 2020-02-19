const fs = require('fs-extra');
const XmlStream = require('xml-stream');

function parseHTMLFile(file) {

  return new Promise((resolve, reject) => {

    const meta = {};

    const stream = fs.createReadStream(file);

    const xml = new XmlStream(stream);

    xml.collect('strong');
    xml.preserve('p');
    xml.preserve('div');

    // title
    xml.on('endElement: h1 > strong', item => {
      meta.title = item.$text;
    });

    // image link
    xml.on('endElement: a', item => {
      if (item.$ && item.$.class && item.$.class === 'download') {
        meta.fileLink = item.$.href;
      }
    });

    // description
    xml.on('endElement: p', item => {
      if (item.$ && item.$.class && item.$.class === 'description') {
        Object.assign(meta, parseDescription(item.$children));
      }
    });

    // details
    xml.on('endElement: div', item => {
      if (item.$ && item.$.class && item.$.class === 'detailsContent') {
        Object.assign(meta, parseDetails(item.$children));
      }
    });

    xml.on('end', () => {
      resolve(meta);
    });

  });

}

function parseDescription(elements) {

  const desc = {
    misc: []
  };

  const dateRegexp = "(?:\\w+\\s)?[0-9.\\s\\/]+";

  for (let i = 0, l = elements.length; i < l; i++) {
    const el = elements[i];

    if (typeof el === 'string' && /foto/i.test(el)) {
      // parse author and date
      if (new RegExp('Foto:\\s' + dateRegexp).test(el)) {
        // if no name, only date
        desc.date = new RegExp('(' + dateRegexp + ')').exec(el)[1];
      } else if (new RegExp('Foto:\\s.+,\\s' + dateRegexp).test(el)) {
        // name and date
        const matches = new RegExp('Foto:\\s(.+),\\s(' + dateRegexp + ')').exec(el);
        desc.author = matches[1];
        desc.date = matches[2];
      } else if (elements[i + 1] instanceof Object) {
        // if next element is 'strong' tag -> author
        desc.author = elements[i + 1].$text;
        i++;

        // if 3rd element is date
        if (typeof elements[i + 1] === 'string' && new RegExp(dateRegexp).test(elements[i + 1])) {
          desc.date = new RegExp('(' + dateRegexp + ')').exec(elements[i + 1])[1];
          i++;
        }
      }
      // erase space around slash (e.g. '1925/ 1945' -> '1925/1945')
      if (/\d{4}\s?\/\s?\d{4}/.test(desc.date)) {
        desc.date = desc.date.replace(/(\d{4})\s?\/\s?(\d{4})/, '$1/$2');
      }
    } else if (typeof el === 'string' && /eigentümer/i.test(el)) {
      desc.owner = elements[i + 1].$text;
      i++;
    } else if (typeof el === 'string' && /Detail:/i.test(el)) {
      desc.description = /Detail: (.*)/.exec(el)[1];
    } else if (typeof el === 'string' && /aufn\.-nr/i.test(el)) {
      desc.captureNo = elements[i + 1].$text;
      i++;
    } else if (typeof el === 'string') {
      desc.misc.push(el);
    }
  }

  return desc;

}

function parseDetails(elements) {

  const details = {};

  for (let i = 0, l = elements.length; i < l; i++) {
    const el = elements[i];

    if (el instanceof Object) {
      // retrieve tags
      if (/^stichwörter/i.test(el.$text)) {
        if (elements[i + 1].$children && typeof elements[i + 1].$children[0] === 'string') {
          details.tags = [];
          const tags =  elements[i + 1].$children[0].split(/,\s*/);

          // strip Katalog information from tags
          for (const tag of tags) {
            const kIndex = tag.indexOf('Katalog');
            if (kIndex === -1) {
              details.tags.push(tag);
            } else if (kIndex === 0) {
              break;
            } else {
              details.tags.push(tag.slice(0, kIndex));
              break;
            }
          }
        }
      } else if (/^eschreibung/i.test(el.$text)) {
        details.description = /^Beschreibung:\s(.*)/.exec(el.$text)[1];
      } else if (/^verwalter/i.test(el.$text)) {
        details.custodian = /^Verwalter:\s(.*)/.exec(el.$text)[1];
      }
    }
  }

  return details;

}

module.exports = {
  parseHTMLFile
};
