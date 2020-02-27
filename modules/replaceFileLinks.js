module.exports = function (req, res, next) {

  const sendJson = res.json;

  res.json = function(data) {
    if (Array.isArray(arguments[0])) {
      arguments[0].forEach(data => {
        replaceLinks(data.file);
      })
    } else {
      replaceLinks(arguments[0].file);
    }
    sendJson.apply(res, arguments);
  };

  next();

};

function replaceLinks(file) {
  if (!file) return;

  const regexp = /^([^_]+)_(.+)_(\d{7})(?:_.+)?\.(?:jpg|png)$/;

  const matches = regexp.exec(file.original);

  const url = `${ matches[1] }/${ matches[2] }/${ matches[3].replace(/\d{3}$/, '000') }/${ file.original.replace(/__\d_/, '') }`;

  file.full = 'http://fotothek.slub-dresden.de/fotos/' + url;
  file.thumb = 'http://fotothek.slub-dresden.de/mids/' + url;

  delete file.id;
  delete file.path;
  delete file.preview;
  delete file.original;
}
