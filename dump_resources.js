const fs = require('fs');
const path = require('path');

const i18nPath = path.join(__dirname, 'frontend', 'src', 'i18n.js');
let code = fs.readFileSync(i18nPath, 'utf8');

// Strip ESM syntax to make it evaluatable in Node
let cleanCode = code
  .replace(/import\s+i18n\s+from\s+'i18next';/, '//')
  .replace(/import\s+\{\s*initReactI18next\s*\}\s+from\s+'react-i18next';/, '//')
  .replace(/export\s+default\s+i18n;/, '//');

global.resourcesObj = null;

const i18n = {
  use: function() { return this; },
  init: function(options) {
    global.resourcesObj = options.resources;
  }
};
const initReactI18next = {};
const localStorage = {
  getItem: () => 'en'
};

// Eval the clean code to get resourcesObj
eval(cleanCode);

const resources = global.resourcesObj;
fs.writeFileSync(path.join(__dirname, 'scratch', 'resources.json'), JSON.stringify(resources, null, 2), 'utf8');
console.log("Dumped resources to scratch/resources.json");
