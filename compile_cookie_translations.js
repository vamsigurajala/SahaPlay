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
if (!resources) {
  console.error("Failed to parse resources from i18n.js");
  process.exit(1);
}

// Load translated cookie keys
const transPath = path.join(__dirname, 'cookie_translations.json');
if (!fs.existsSync(transPath)) {
  console.error("cookie_translations.json does not exist!");
  process.exit(1);
}

const cookieTranslations = JSON.parse(fs.readFileSync(transPath, 'utf8'));

// Inject and sort translations
for (const lang in cookieTranslations) {
  if (!resources[lang]) {
    resources[lang] = { translation: {} };
  }
  if (!resources[lang].translation) {
    resources[lang].translation = {};
  }
  
  for (const key in cookieTranslations[lang]) {
    resources[lang].translation[key] = cookieTranslations[lang][key];
  }
  
  // Sort alphabetically
  const sorted = {};
  Object.keys(resources[lang].translation).sort().forEach(k => {
    sorted[k] = resources[lang].translation[k];
  });
  resources[lang].translation = sorted;
}

// Generate Resources Block
const newResourcesBlock = "const resources = " + JSON.stringify(resources, null, 2) + ";";

const startMarker = "const resources =";
const startIndex = code.indexOf(startMarker);
if (startIndex === -1) {
  console.error("Could not find resources block start");
  process.exit(1);
}

const endMatch = code.match(/i18n\s*\.use/);
if (!endMatch) {
  console.error("Could not find resources block end");
  process.exit(1);
}
const endIndex = endMatch.index;

const originalDeclaration = code.substring(startIndex, endIndex);
const updatedCode = code.replace(originalDeclaration, newResourcesBlock + "\n\n");

fs.writeFileSync(i18nPath, updatedCode, 'utf8');
console.log("Successfully updated and sorted cookie translations in i18n.js!");
