// ip-api.com country name → ISO 3166-1 alpha-2 code
const COUNTRY_NAME_TO_CODE = {
  'Afghanistan': 'AF', 'Albania': 'AL', 'Algeria': 'DZ', 'Argentina': 'AR',
  'Armenia': 'AM', 'Australia': 'AU', 'Austria': 'AT', 'Azerbaijan': 'AZ',
  'Bangladesh': 'BD', 'Belarus': 'BY', 'Belgium': 'BE', 'Bolivia': 'BO',
  'Brazil': 'BR', 'Bulgaria': 'BG', 'Cambodia': 'KH', 'Canada': 'CA',
  'Chile': 'CL', 'China': 'CN', 'Colombia': 'CO', 'Croatia': 'HR',
  'Czech Republic': 'CZ', 'Denmark': 'DK', 'Ecuador': 'EC', 'Egypt': 'EG',
  'Ethiopia': 'ET', 'Finland': 'FI', 'France': 'FR', 'Georgia': 'GE',
  'Germany': 'DE', 'Ghana': 'GH', 'Greece': 'GR', 'Hungary': 'HU',
  'India': 'IN', 'Indonesia': 'ID', 'Iran': 'IR', 'Iraq': 'IQ',
  'Ireland': 'IE', 'Israel': 'IL', 'Italy': 'IT', 'Japan': 'JP',
  'Jordan': 'JO', 'Kazakhstan': 'KZ', 'Kenya': 'KE', 'South Korea': 'KR',
  'Kuwait': 'KW', 'Malaysia': 'MY', 'Mexico': 'MX', 'Morocco': 'MA',
  'Myanmar': 'MM', 'Nepal': 'NP', 'Netherlands': 'NL', 'New Zealand': 'NZ',
  'Nigeria': 'NG', 'Norway': 'NO', 'Pakistan': 'PK', 'Peru': 'PE',
  'Philippines': 'PH', 'Poland': 'PL', 'Portugal': 'PT', 'Qatar': 'QA',
  'Romania': 'RO', 'Russia': 'RU', 'Saudi Arabia': 'SA', 'Serbia': 'RS',
  'Singapore': 'SG', 'South Africa': 'ZA', 'Spain': 'ES', 'Sri Lanka': 'LK',
  'Sweden': 'SE', 'Switzerland': 'CH', 'Syria': 'SY', 'Taiwan': 'TW',
  'Thailand': 'TH', 'Tunisia': 'TN', 'Turkey': 'TR', 'UAE': 'AE',
  'Ukraine': 'UA', 'United Kingdom': 'GB', 'United States': 'US',
  'Uruguay': 'UY', 'Uzbekistan': 'UZ', 'Venezuela': 'VE', 'Vietnam': 'VN',
  'Yemen': 'YE', 'Zimbabwe': 'ZW',
};

// Build a flagcdn.com image URL from a 2-letter ISO code.
export function getFlagUrl(code, size = 40) {
  if (!code || code.length !== 2) return null;
  return `https://flagcdn.com/w${size}/${code.toLowerCase()}.png`;
}

// Look up the code from a country name, then build the URL.
export function getFlagUrlFromName(name, size = 40) {
  if (!name) return null;
  const code = COUNTRY_NAME_TO_CODE[name];
  return code ? getFlagUrl(code, size) : null;
}

// Unicode flag emoji from a 2-letter ISO code (each letter maps to its
// Regional Indicator Symbol, U+1F1E6 = 'A' + 0x1F1E6-0x41 offset) — renders
// via the OS/browser's own emoji font, with zero network request. Used in
// preference to getFlagUrl's flagcdn.com <img> wherever reliability matters
// more than the sharper bitmap look: flagcdn.com being blocked or slow
// (corporate networks, ad/tracker blockers treating a third-party image CDN
// as trackable, flaky mobile data) silently produced a flag-shaped hole via
// the <img>'s onError handler, with no way to tell "never loaded" apart from
// "genuinely no country set" from the UI alone.
export function getFlagEmoji(code) {
  if (!code || code.length !== 2) return null;
  const codePoints = code.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// Look up the code from a country name, then build the emoji.
export function getFlagEmojiFromName(name) {
  if (!name) return null;
  const code = COUNTRY_NAME_TO_CODE[name];
  return code ? getFlagEmoji(code) : null;
}
