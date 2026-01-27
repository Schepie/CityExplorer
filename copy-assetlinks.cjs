const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');

const src = path.join(__dirname, '.well-known', 'assetlinks.json');
const destFolder = path.join(__dirname, 'dist', '.well-known');
const dest = path.join(destFolder, 'assetlinks.json');

mkdirp.sync(destFolder);
fs.copyFileSync(src, dest);

console.log('✅ assetlinks.json gekopieerd naar dist/.well-known/');
