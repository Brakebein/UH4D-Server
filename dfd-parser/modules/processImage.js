const uuid = require('uuid/v4');
const fs = require('fs-extra');
const execFile = require('child-process-promise').execFile;
const pathUtils = require('path');
const config = require('../../config');;

async function processImage(file) {

  const shortPath = `images/${uuid()}/`;
  const path = config.path.data + '/' + shortPath;
  const filename = pathUtils.basename(file);
  const filenameThumb = filename.slice(0, filename.lastIndexOf('.')) + '_thumb.jpg';
  const filenamePreview = filename.slice(0, filename.lastIndexOf('.')) + '_preview.jpg';

  console.debug('Directory:', shortPath, 'File:', filename);

  try {
    // get image size
    const result = await execFile(config.exec.ImagickIdentify, [file]);
    const matches = result.stdout.match(/\s(\d+)x(\d+)\s/);
    const width = +matches[1];
    const height = +matches[2];

    // create directory
    await fs.ensureDir(config.path.data + '/images');

    // copy image into directory
    await fs.copy(file, path + filename);

    // create thumbnail
    await execFile(config.exec.ImagickConvert, [path + filename, '-resize', '200x200>', path + filenameThumb]);

    // down-sample preview image
    await execFile(config.exec.ImagickConvert, [path + filename, '-resize', '2048x2048>', path + filenamePreview]);

    return {
      path: shortPath,
      original: filename,
      type: filename.split('.').pop().toLowerCase(),
      preview: filenamePreview,
      thumb: filenameThumb,
      width,
      height
    };
  } catch (err) {
    throw err;
  }

}

module.exports = {
  processImage
};
