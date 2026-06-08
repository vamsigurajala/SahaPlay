const fs = require('fs');
const path = require('path');

const i18nPath = path.resolve(__dirname, 'frontend', 'src', 'i18n.js');
const backupPath = i18nPath + '.backup2';

const COOKIE_KEYS = new Set([
  'cookiePageBadge','cookiePolicyTitle','cookieHeroDesc','cookieLastUpdated',
  'cookieWhatTitle','cookieWhatDesc','cookieHowTitle','cookieHowDesc',
  'cookieAuthTitle','cookieAuthItem1','cookieAuthItem2','cookieAuthItem3',
  'cookieSecurityTitle','cookieSecurityItem1','cookieSecurityItem2','cookieSecurityItem3',
  'cookiePrefsTitle','cookiePrefsItem1','cookiePrefsItem2','cookiePrefsItem3',
  'cookiePerfTitle','cookiePerfItem1','cookiePerfItem2','cookiePerfItem3',
  'cookieStorageTitle','cookieStorageDesc','cookieLocalTitle','cookieLocalDesc',
  'cookieLocalItem1','cookieLocalItem2','cookieLocalItem3',
  'cookieSessionTitle','cookieSessionDesc','cookieSessionItem1','cookieSessionItem2','cookieSessionItem3',
  'cookieIndexedTitle','cookieIndexedDesc','cookieIndexedItem1','cookieIndexedItem2','cookieIndexedItem3',
  'cookieChatLockTitle','cookieChatLockDesc','cookieChatLockE2ee',
  'cookiePinMeta','cookieMasterKey','cookieLockTimer','cookieE2eeSession',
  'cookieThirdTitle','cookieThirdDesc',
  'cookieSupabaseTitle','cookieSupabaseDesc','cookieSupabaseItem1','cookieSupabaseItem2','cookieSupabaseItem3',
  'cookieFutureTitle','cookieFutureDesc','cookieFutureItem1','cookieFutureItem2','cookieFutureItem3',
  'cookieFutureNote',
  'cookieManageTitle','cookieManageDesc',
  'cookieChromeTitle','cookieChromeDesc','cookieEdgeTitle','cookieEdgeDesc',
  'cookieFirefoxTitle','cookieFirefoxDesc','cookieSafariTitle','cookieSafariDesc',
  'cookieDisableTitle','cookieDisableDesc',
  'cookieDisableItem1','cookieDisableItem2','cookieDisableItem3','cookieDisableItem4',
  'cookieContactTitle','cookieContactDesc','cookieContactBtn',
]);

fs.copyFileSync(i18nPath, backupPath);
console.log('✓ Backup saved to', backupPath);

const lines = fs.readFileSync(i18nPath, 'utf8').split('\n');
const result = [];
let currentLang = null;
let removedTotal = 0;
const removedByLang = {};

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Detect language block start
  const langMatch = line.match(/^  "([a-z]{2})": \{/);
  if (langMatch) currentLang = langMatch[1];

  // Skip cookie keys in non-English blocks
  if (currentLang && currentLang !== 'en') {
    const keyMatch = line.match(/^\s+"(cookie\w+)":/);
    if (keyMatch && COOKIE_KEYS.has(keyMatch[1])) {
      removedByLang[currentLang] = (removedByLang[currentLang] || 0) + 1;
      removedTotal++;
      continue;
    }
  }

  result.push(line);
}

fs.writeFileSync(i18nPath, result.join('\n'), 'utf8');

console.log(`\nRemoved cookie keys from ${Object.keys(removedByLang).length} language block(s):`);
Object.entries(removedByLang).forEach(([lang, count]) => {
  console.log(`  ✓  ${lang}  — ${count} keys removed`);
});
console.log(`\nTotal keys removed: ${removedTotal}`);
console.log('English block unchanged — fallbackLng:"en" will serve those keys.');
console.log('Done.');
