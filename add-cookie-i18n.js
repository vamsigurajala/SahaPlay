const fs = require('fs');
const path = require('path');

const i18nPath = path.resolve(__dirname, 'frontend', 'src', 'i18n.js');
const backupPath = i18nPath + '.backup';

const COOKIE_KEYS = {
  cookiePageBadge: 'Security & Storage',
  cookiePolicyTitle: 'Cookie Policy',
  cookieHeroDesc: 'Learn how SahaPlay uses cookies, browser storage, authentication technologies, and security mechanisms to provide a secure and personalized experience.',
  cookieLastUpdated: 'Last Updated: May 2026',
  cookieWhatTitle: 'What are Cookies?',
  cookieWhatDesc: 'Cookies are small pieces of data stored in your browser that help websites remember information between visits. SahaPlay uses cookies and similar browser technologies to support authentication, security, preferences, and application performance.',
  cookieHowTitle: 'How SahaPlay Uses Cookies',
  cookieHowDesc: 'We use cookies and browser storage technologies to enable essential core features.',
  cookieAuthTitle: 'Authentication',
  cookieAuthItem1: 'Keeps users signed in securely.',
  cookieAuthItem2: 'Maintains active sessions.',
  cookieAuthItem3: 'Reduces unnecessary logins.',
  cookieSecurityTitle: 'Security',
  cookieSecurityItem1: 'Protects accounts and sessions.',
  cookieSecurityItem2: 'Supports security verification.',
  cookieSecurityItem3: 'Helps prevent unauthorized access.',
  cookiePrefsTitle: 'Preferences',
  cookiePrefsItem1: 'Remembers theme settings (dark/light mode).',
  cookiePrefsItem2: 'Remembers interface preferences.',
  cookiePrefsItem3: 'Stores user customization choices.',
  cookiePerfTitle: 'Performance',
  cookiePerfItem1: 'Improves loading speed.',
  cookiePerfItem2: 'Supports reconnection features.',
  cookiePerfItem3: 'Optimizes application responsiveness.',
  cookieStorageTitle: 'Browser Storage Technologies',
  cookieStorageDesc: 'Apart from traditional cookies, we utilize modern browser storage mechanisms to save data locally.',
  cookieLocalTitle: 'localStorage',
  cookieLocalDesc: 'Persistent key-value database that remains after the browser window is closed.',
  cookieLocalItem1: 'Theme preferences',
  cookieLocalItem2: 'User interface settings',
  cookieLocalItem3: 'Room preferences',
  cookieSessionTitle: 'sessionStorage',
  cookieSessionDesc: 'Temporary key-value storage that is completely cleared when the browser tab is closed.',
  cookieSessionItem1: 'Temporary session info',
  cookieSessionItem2: 'Navigation state',
  cookieSessionItem3: 'Session-specific data',
  cookieIndexedTitle: 'IndexedDB',
  cookieIndexedDesc: 'A full client-side relational database designed for storing large amounts of structured data.',
  cookieIndexedItem1: 'Application caching',
  cookieIndexedItem2: 'Performance optimization',
  cookieIndexedItem3: 'Encrypted local application data',
  cookieChatLockTitle: 'Chat Lock & Security Storage',
  cookieChatLockDesc: 'SahaPlay includes a built-in Chat Lock feature designed to keep your personal chats private. To protect these conversations, the app stores cryptographically secure credentials locally on your browser.',
  cookieChatLockE2ee: 'End-to-end encryption key material is stored in session memory only and is never written to disk or sent to our servers.',
  cookiePinMeta: 'PIN verification metadata',
  cookieMasterKey: 'Master Key verification details',
  cookieLockTimer: 'Lockout timer state',
  cookieE2eeSession: 'E2EE Key Material (session only)',
  cookieThirdTitle: 'Third-Party Services',
  cookieThirdDesc: 'We work with premium service providers who also utilize cookies and local storage to run application layers.',
  cookieSupabaseTitle: 'Supabase',
  cookieSupabaseDesc: 'Supabase acts as our primary database and backend infrastructure provider. It stores tokens and session states locally in your browser.',
  cookieSupabaseItem1: 'Authentication',
  cookieSupabaseItem2: 'Realtime Sync',
  cookieSupabaseItem3: 'Database Storage',
  cookieFutureTitle: 'Future Integrations',
  cookieFutureDesc: 'We may introduce third-party tools to help analyze user feedback, monitor application health, and report crashes.',
  cookieFutureItem1: 'Analytics',
  cookieFutureItem2: 'Performance Logging',
  cookieFutureItem3: 'Error Reports',
  cookieFutureNote: 'Third-party services operate under their own privacy policies. You can choose to block third-party cookies directly in your browser.',
  cookieManageTitle: 'How to Manage Cookies',
  cookieManageDesc: 'You have full control over browser data. Here is how to modify settings in popular browsers.',
  cookieChromeTitle: 'Google Chrome',
  cookieChromeDesc: 'Settings → Privacy and Security → Cookies and Other Site Data',
  cookieEdgeTitle: 'Microsoft Edge',
  cookieEdgeDesc: 'Settings → Cookies and Site Permissions → Manage and Delete Cookies',
  cookieFirefoxTitle: 'Mozilla Firefox',
  cookieFirefoxDesc: 'Settings → Privacy & Security → Cookies and Site Data',
  cookieSafariTitle: 'Apple Safari',
  cookieSafariDesc: 'Settings → Privacy → Manage Website Data → Remove All',
  cookieDisableTitle: 'Disabling Browser Storage',
  cookieDisableDesc: 'Please note that if you block all cookies and local browser storage, certain parts of SahaPlay may cease to function correctly. This will specifically impact:',
  cookieDisableItem1: 'Active login sessions and auto-login workflows',
  cookieDisableItem2: 'Theme choices (defaults back to dark mode)',
  cookieDisableItem3: 'Active room states and synchronization parameters',
  cookieDisableItem4: 'Chat Lock protection vault and PIN recovery workflows',
  cookieContactTitle: 'Questions About Our Cookie Policy?',
  cookieContactDesc: 'Our security and support teams are here to help. Reach out if you want to know more about how we safeguard your data.',
  cookieContactBtn: 'Contact Us',
};

// ── Backup ──────────────────────────────────────────────────────────────────
fs.copyFileSync(i18nPath, backupPath);
console.log('✓ Backup saved to', backupPath);

// ── Read ─────────────────────────────────────────────────────────────────────
const content = fs.readFileSync(i18nPath, 'utf8');
const lines = content.split('\n');

// ── Build insertion lines ────────────────────────────────────────────────────
const entries = Object.entries(COOKIE_KEYS);
const insertionLines = entries.map(([key, value], idx) => {
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const comma = idx < entries.length - 1 ? ',' : '';
  return `      "${key}": "${escaped}"${comma}`;
});

// ── Process line by line ─────────────────────────────────────────────────────
const result = [];
const updated = [];
const skipped = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  if (!line.includes('"voiceVideoDesc"')) {
    result.push(line);
    continue;
  }

  // Check if cookiePageBadge already inserted (would be within ~5 lines after)
  let alreadyHas = false;
  for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
    if (lines[j].includes('"cookiePageBadge"')) {
      alreadyHas = true;
      break;
    }
  }

  // Identify which language block this voiceVideoDesc belongs to
  let langName = '??';
  for (let j = i - 1; j >= Math.max(0, i - 1500); j--) {
    const m = lines[j].match(/^  "([a-z]{2})": \{/);
    if (m) { langName = m[1]; break; }
  }

  if (alreadyHas) {
    skipped.push(langName);
    result.push(line);
    continue;
  }

  // Ensure voiceVideoDesc line ends with a comma before we append keys after it
  const trimmed = line.trimEnd();
  result.push(trimmed.endsWith(',') ? line : trimmed + ',');

  // Insert all cookie keys
  result.push(...insertionLines);
  updated.push(langName);
}

// ── Write ─────────────────────────────────────────────────────────────────────
fs.writeFileSync(i18nPath, result.join('\n'), 'utf8');

// ── Report ────────────────────────────────────────────────────────────────────
console.log(`\nUpdated ${updated.length} language block(s):`);
updated.forEach(l => console.log(`  ✓  ${l}  — ${entries.length} keys inserted`));
if (skipped.length) {
  console.log(`\nSkipped ${skipped.length} (already had cookiePageBadge):`);
  skipped.forEach(l => console.log(`  –  ${l}`));
}
console.log(`\nTotal keys inserted: ${updated.length * entries.length}`);
console.log('Done.');
