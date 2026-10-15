// Script to download curated images for Gamify Mode:
// - ~89 books
// - ~130 foods
// - 93 wardrobe items
// - 33 cosmetics items
// - 38 garden items
// And output a manifest.json + gamifyManifest.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_GAMIFY = path.join(ROOT, 'frontend', 'public', 'images', 'gamify');

const DIRS = ['books', 'foods', 'wardrobe', 'cosmetics', 'garden'];
DIRS.forEach(d => fs.mkdirSync(path.join(PUBLIC_GAMIFY, d), { recursive: true }));

const UA = 'SahaPlay/1.0 (https://sahaplay.com; contact@sahaplay.com)';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchBufferWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 12000);
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctl.signal });
      clearTimeout(t);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 500) return buf;
      }
    } catch (e) {
      // retry
    }
    await sleep(400 * (i + 1));
  }
  return null;
}

async function getWikiThumbnail(title) {
  const titles = Array.isArray(title) ? title : [title];
  for (const t of titles) {
    try {
      const ctl = new AbortController();
      const timeout = setTimeout(() => ctl.abort(), 10000);
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t)}`, {
        headers: { 'User-Agent': UA },
        signal: ctl.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (data?.thumbnail?.source) {
          const buf = await fetchBufferWithRetry(data.thumbnail.source);
          if (buf) return { buf, url: data.thumbnail.source };
        }
      }
    } catch (e) {
      // try next fallback title
    }
    await sleep(150);
  }
  return null;
}

async function getOpenLibraryCover(book) {
  const QUERY = {
    gitanjali: { title: 'Gitanjali', author: 'Rabindranath Tagore' },
    gitanjali1: { title: 'Gitanjali', author: 'Rabindranath Tagore' },
    panchatantra: { title: 'Panchatantra', author: 'Vishnu Sharma' },
    tenali: { title: 'Tenali Rama', author: '' },
    birbal: { title: 'Akbar and Birbal', author: '' },
  };
  const q = QUERY[book.id] || { title: book.title.replace(/\(.*?\)/g, '').trim(), author: book.author };
  const searchUrl = `https://openlibrary.org/search.json?limit=1&fields=cover_i&title=${encodeURIComponent(q.title)}${q.author ? `&author=${encodeURIComponent(q.author)}` : ''}`;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 10000);
    const res = await fetch(searchUrl, { headers: { 'User-Agent': UA }, signal: ctl.signal });
    clearTimeout(t);
    if (res.ok) {
      const data = await res.json();
      const coverId = data?.docs?.[0]?.cover_i;
      if (coverId && coverId > 0) {
        const imgUrl = `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`;
        const buf = await fetchBufferWithRetry(imgUrl);
        if (buf) return { buf, url: imgUrl };
      }
    }
  } catch (e) {
    // fallback
  }
  return null;
}

// Generate styled classic cover SVG when no Open Library cover exists
function generateClassicCoverSvg(book) {
  const GENRE_COLORS = {
    horror: ['#7a1020', '#1a0a12', '#ffd9d9'],
    thriller: ['#2a3a5a', '#0c1220', '#d9e6ff'],
    crime: ['#3a3a3a', '#14141a', '#f0e6c8'],
    romance: ['#c24f7a', '#5a1a3a', '#fff0f6'],
    adventure: ['#2f7a5a', '#10301f', '#e6fff0'],
    scifi: ['#3a5ac2', '#10183a', '#e0e8ff'],
    classic: ['#8a5a34', '#2a1a0e', '#fff0d9'],
    indian: ['#d0792a', '#4a2208', '#fff2d9'],
    philosophy: ['#6a5aa8', '#1a1440', '#ece6ff'],
    poetry: ['#2f8fa8', '#0c2a36', '#e0f6ff'],
  };
  const [c1, c2, ink] = GENRE_COLORS[book.genre] || ['#4a3a6a', '#1a1428', '#fff'];
  const title = escapeXml(book.title);
  const author = escapeXml(book.author || '');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 450" width="300" height="450">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="100%" stop-color="${c2}"/>
      </linearGradient>
      <linearGradient id="spine" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="rgba(0,0,0,0.5)"/>
        <stop offset="50%" stop-color="rgba(255,255,255,0.15)"/>
        <stop offset="100%" stop-color="transparent"/>
      </linearGradient>
    </defs>
    <rect width="300" height="450" rx="6" fill="url(#bg)"/>
    <rect x="18" y="18" width="264" height="414" rx="4" fill="none" stroke="rgba(255,215,120,0.5)" stroke-width="2"/>
    <rect x="24" y="24" width="252" height="402" rx="2" fill="none" stroke="rgba(255,215,120,0.25)" stroke-width="1"/>
    <rect width="20" height="450" fill="url(#spine)"/>
    <circle cx="150" cy="140" r="42" fill="none" stroke="${ink}" stroke-width="2" opacity="0.4"/>
    <text x="150" y="220" text-anchor="middle" font-family="Georgia, serif" font-size="22" font-weight="bold" fill="${ink}">${title}</text>
    <text x="150" y="260" text-anchor="middle" font-family="Georgia, serif" font-size="14" font-style="italic" fill="${ink}" opacity="0.85">${author}</text>
    <path d="M 120 285 L 180 285" stroke="${ink}" stroke-width="1.5" opacity="0.4"/>
    <text x="150" y="380" text-anchor="middle" font-family="sans-serif" font-size="10" font-weight="bold" letter-spacing="3" text-transform="uppercase" fill="${ink}" opacity="0.6">${book.genre.toUpperCase()}</text>
  </svg>`);
}

function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function run() {
  console.log('--- Starting Gamify Mode Asset Curation ---');
  const manifest = {
    books: {},
    foods: {},
    wardrobe: {},
    cosmetics: {},
    garden: {},
  };

  // 1. BOOKS (~89 books)
  console.log('\nProcessing Books...');
  const { BOOKS } = await import('../frontend/src/data/gamifyBooks.js');
  let bookDownloaded = 0;
  for (const book of BOOKS) {
    const filePath = path.join(PUBLIC_GAMIFY, 'books', `${book.id}.jpg`);
    const relUrl = `/images/gamify/books/${book.id}.jpg`;
    manifest.books[book.id] = relUrl;

    if (fs.existsSync(filePath)) {
      bookDownloaded++;
      continue;
    }

    let item = await getOpenLibraryCover(book);
    if (!item) {
      // try wikipedia for the work
      item = await getWikiThumbnail([book.title, `${book.title} (novel)`, `${book.title} (book)`, book.author]);
    }

    if (item && item.buf) {
      fs.writeFileSync(filePath, item.buf);
      bookDownloaded++;
      console.log(`[Book] ${book.id} (${book.title}) -> saved from ${item.url.slice(0, 45)}...`);
    } else {
      // Generate classic cover SVG
      const svgBuf = generateClassicCoverSvg(book);
      fs.writeFileSync(filePath, svgBuf);
      bookDownloaded++;
      console.log(`[Book] ${book.id} (${book.title}) -> generated classic cover`);
    }
    await sleep(150);
  }
  console.log(`Books complete: ${bookDownloaded} / ${BOOKS.length}`);

  // 2. FOODS (~130 foods)
  console.log('\nProcessing Foods...');
  const { FOOD_WIKI } = await import('../frontend/src/data/foodWiki.js');
  
  // Base kitchen foods from FOOD_WIKI
  const foodMap = { ...FOOD_WIKI };

  // Expand with additional typical Indian house pantry & dining foods to reach ~130
  const EXTRA_FOODS = {
    'Basmati rice': 'Basmati',
    'Atta (wheat flour)': 'Atta_flour',
    'Ghee': 'Ghee',
    'Turmeric (haldi)': 'Turmeric',
    'Cumin seeds (jeera)': 'Cumin',
    'Mustard seeds (rai)': 'Mustard_seed',
    'Cardamom (elaichi)': 'Cardamom',
    'Cinnamon (dalchini)': 'Cinnamon',
    'Cloves (laung)': 'Clove',
    'Black pepper (kali mirch)': 'Black_pepper',
    'Saffron (kesar)': 'Saffron',
    'Cashew nuts (kaju)': 'Cashew',
    'Almonds (badaam)': 'Almond',
    'Pistachios (pista)': 'Pistachio',
    'Raisins (kishmish)': 'Raisin',
    'Jaggery (gur)': 'Jaggery',
    'Sugar': 'Sugar',
    'Salt': 'Salt',
    'Tea leaves': 'Tea',
    'Coffee beans': 'Coffee_bean',
    'Besan (gram flour)': 'Gram_flour',
    'Sooji (semolina)': 'Semolina',
    'Poha (flattened rice)': 'Flattened_rice',
    'Moong dal': 'Mung_bean',
    'Toor dal': 'Pigeon_pea',
    'Chana dal': 'Chickpea',
    'Urad dal': 'Vigna_mungo',
    'Red kidney beans (rajma)': 'Kidney_bean',
    'Kabuli chana (chickpeas)': 'Chickpea',
    'Garam masala': 'Garam_masala',
    'Kasuri methi': 'Fenugreek',
    'Asafoetida (hing)': 'Asafoetida',
    'Tamarind (imli)': 'Tamarind',
    'Coconut': 'Coconut',
    'Fresh mango': 'Mango',
    'Banana': 'Banana',
    'Apple': 'Apple',
    'Fresh orange': 'Orange_(fruit)',
    'Guava': 'Guava',
    'Papaya': 'Papaya',
    'Pomegranate': 'Pomegranate',
    'Samosa': 'Samosa',
    'Pakora': 'Pakora',
    'Jalebi': 'Jalebi',
    'Kaju katli': 'Kaju_katli',
    'Besan ladoo': 'Laddu',
    'Gajar halwa': 'Gajar_ka_halwa',
    'Kheer': 'Kheer',
    'Boondi raita': 'Raita',
    'Papad': 'Papadam',
    'Idli': 'Idli',
    'Medu vada': 'Vada_(food)',
    'Sambar': 'Sambar_(dish)',
    'Rasam': 'Rasam',
    'Puri': 'Puri_(food)',
    'Bhature': 'Bhatura',
    'Vegetable pulao': 'Pilaf',
    'Khichdi': 'Khichdi',
    'Chai cup': 'Chai',
    'Filter coffee': 'Indian_filter_coffee',
    'Sweet lassi': 'Lassi',
    'Buttermilk (chaas)': 'Chaas',
    'Badam milk': 'Almond_milk',
    'Rose sharbat': 'Sharbat',
    'Jaljeera': 'Jal-jeera',
    'Aam panna': 'Aam_panna',
    'Thandai': 'Thandai',
    'Kokum sharbat': 'Garcinia_indica',
    'Sugarcane juice': 'Sugarcane_juice',
    'Coconut water': 'Coconut_water',
    'Pani puri': 'Panipuri',
    'Bhel puri': 'Bhelpuri',
    'Pav bhaji': 'Pav_bhaji',
  };

  Object.assign(foodMap, EXTRA_FOODS);

  let foodCount = 0;
  for (const [name, wikiTitle] of Object.entries(foodMap)) {
    const slug = slugify(name);
    const filePath = path.join(PUBLIC_GAMIFY, 'foods', `${slug}.jpg`);
    const relUrl = `/images/gamify/foods/${slug}.jpg`;
    manifest.foods[name] = relUrl;

    if (fs.existsSync(filePath)) {
      foodCount++;
      continue;
    }

    const item = await getWikiThumbnail(wikiTitle);
    if (item && item.buf) {
      fs.writeFileSync(filePath, item.buf);
      foodCount++;
      console.log(`[Food] ${name} -> saved from ${item.url.slice(0, 45)}...`);
    } else {
      console.warn(`[Food] WARNING: could not fetch image for ${name} (${wikiTitle})`);
    }
    await sleep(150);
  }
  console.log(`Foods complete: ${foodCount} / ${Object.keys(foodMap).length}`);

  // 3. WARDROBE (93 items)
  console.log('\nProcessing Wardrobe items...');
  const { WARDROBES } = await import('../frontend/src/data/gamifyItems.js');
  const WARDROBE_WIKI = {
    'Checked shirt': 'Flannel',
    'White shirt': 'Dress_shirt',
    'Denim jacket': 'Jean_jacket',
    'Blue kurta': 'Kurta',
    'Hoodie': 'Hoodie',
    'Blazer': 'Blazer',
    'T-shirt': 'T-shirt',
    'Jeans': 'Jeans',
    'Shorts': 'Shorts',
    'Sweater': 'Sweater',
    'Track pants': 'Sweatpants',
    'Polo T-shirt': 'Polo_shirt',
    'Sneakers': 'Sneakers',
    'Formal shoes': 'Dress_shoe',
    'Sandals': 'Sandal',
    'Cap': 'Baseball_cap',
    'Belt': 'Belt_(clothing)',
    'Watch': 'Watch',
    'Sunglasses': 'Sunglasses',
    'Backpack': 'Backpack',
    'Silk saree': 'Sari',
    'Green saree': ['Sari', 'Silk'],
    'Anarkali kurta': 'Anarkali_Salwar_Suit',
    'Lehenga': 'Lehenga',
    'Sherwani': 'Sherwani',
    'Dupatta': 'Dupatta',
    'Cotton kurti': 'Kurta',
    'Leggings': 'Leggings',
    'Palazzo': 'Palazzo_pants',
    'Salwar suit': 'Salwar_kameez',
    'Blouse': 'Blouse',
    'Pyjama set': 'Pajamas',
    'Heels': 'High-heeled_shoe',
    'Juttis': 'Mojari',
    'Ballet flats': 'Ballet_flat',
    'Handbag': 'Handbag',
    'Clutch': 'Clutch_(handbag)',
    'Scarf': 'Scarf',
    'Puffer jacket': 'Down_jacket',
    'Woollen coat': 'Overcoat',
    'Shawl': 'Shawl',
    'Raincoat': 'Raincoat',
    'Cardigan': 'Cardigan_(sweater)',
    'Leather jacket': 'Leather_jacket',
    'Thermals': 'Long_underwear',
    'Woollen sweater': 'Sweater',
    'Cargo pants': 'Cargo_pants',
    'Socks': 'Sock',
    'Gloves': 'Glove',
    'Woollen cap': 'Knit_cap',
    'Trekking boots': 'Hiking_boot',
    'Gum boots': 'Wellington_boot',
    'Suitcase': 'Suitcase',
    'Muffler': 'Scarf',
    'Umbrella': 'Umbrella',
    'Duffel bag': 'Duffel_bag',
    'Business suit': 'Suit',
    'Nehru jacket': 'Nehru_jacket',
    'Silk shirt': 'Dress_shirt',
    'Pathani suit': 'Salwar_kameez',
    'Banarasi saree': 'Banarasi_sari',
    'Evening gown': 'Evening_gown',
    'Formal trousers': 'Trousers',
    'Chinos': 'Chino_cloth',
    'Night suit': 'Pajamas',
    'Gym shorts': 'Shorts',
    'Silk blouse': 'Blouse',
    'Bathrobe': 'Bathrobe',
    'Oxford shoes': 'Oxford_shoe',
    'Loafers': 'Loafer',
    'Slippers': 'Slipper',
    'Silk tie': 'Necktie',
    'Wrist watch': 'Watch',
    'Leather wallet': 'Wallet',
    'Aviators': 'Aviator_sunglasses',
    'Wedding sherwani': 'Sherwani',
    'Bridal lehenga': 'Lehenga',
    'Kanjivaram saree': 'Kanchipuram_silk_sari',
    'Festive kurta': 'Kurta',
    'Silk dupatta': 'Dupatta',
    'Cocktail dress': 'Cocktail_dress',
    'Kids party wear': 'Party_dress',
    'School uniform': 'School_uniform',
    'School shorts': 'Shorts',
    'Beach shorts': 'Boardshorts',
    'Rain jacket': 'Raincoat',
    'Woollen socks': 'Sock',
    'Cabin suitcase': 'Suitcase',
    'Trekking backpack': 'Backpack',
    'Flip-flops': 'Flip-flops',
    'Canvas shoes': 'Plimsoll_shoe',
    'Sun hat': 'Sun_hat',
    'Travel umbrella': 'Umbrella',
  };

  let wardrobeCount = 0;
  for (const [name, wikiTitle] of Object.entries(WARDROBE_WIKI)) {
    const slug = slugify(name);
    const filePath = path.join(PUBLIC_GAMIFY, 'wardrobe', `${slug}.jpg`);
    const relUrl = `/images/gamify/wardrobe/${slug}.jpg`;
    manifest.wardrobe[name] = relUrl;

    if (fs.existsSync(filePath)) {
      wardrobeCount++;
      continue;
    }

    const item = await getWikiThumbnail(wikiTitle);
    if (item && item.buf) {
      fs.writeFileSync(filePath, item.buf);
      wardrobeCount++;
      console.log(`[Wardrobe] ${name} -> saved from ${item.url.slice(0, 45)}...`);
    } else {
      console.warn(`[Wardrobe] WARNING: could not fetch ${name} (${wikiTitle})`);
    }
    await sleep(150);
  }
  console.log(`Wardrobe complete: ${wardrobeCount} / ${Object.keys(WARDROBE_WIKI).length}`);

  // 4. COSMETICS (33 items)
  console.log('\nProcessing Cosmetics items...');
  const COSMETICS_WIKI = {
    'Lipstick': 'Lipstick',
    'Compact powder': 'Face_powder',
    'Foundation': 'Foundation_(cosmetics)',
    'Kajal': 'Kohl_(cosmetics)',
    'Mascara': 'Mascara',
    'Eyeshadow palette': 'Eye_shadow',
    'Blush': 'Rouge_(cosmetics)',
    'Nail polish': 'Nail_polish',
    'Lip gloss': 'Lip_gloss',
    'Bindi pack': 'Bindi_(decoration)',
    'Sindoor': 'Sindoor',
    'Eyeliner': 'Eye_liner',
    'Wooden comb': 'Comb',
    'Hair brush': 'Hairbrush',
    'Hair clips': 'Hairpin',
    'Hair oil': 'Hair_oil',
    'Shampoo': 'Shampoo',
    'Hair dryer': 'Hair_dryer',
    'Scrunchies': 'Scrunchie',
    'Hair serum': 'Hair_care',
    'Face cream': 'Moisturizer',
    'Face wash': 'Cleanser',
    'Sunscreen': 'Sunscreen',
    'Moisturiser': 'Moisturizer',
    'Perfume': 'Perfume',
    'Rose water': 'Rose_water',
    'Lip balm': 'Lip_balm',
    'Body lotion': 'Lotion',
    'Bangles': 'Bangle',
    'Earrings': 'Earring',
    'Necklace': 'Necklace',
    'Hand mirror': 'Mirror',
    'Tweezers': 'Tweezers',
  };

  let cosmeticsCount = 0;
  for (const [name, wikiTitle] of Object.entries(COSMETICS_WIKI)) {
    const slug = slugify(name);
    const filePath = path.join(PUBLIC_GAMIFY, 'cosmetics', `${slug}.jpg`);
    const relUrl = `/images/gamify/cosmetics/${slug}.jpg`;
    manifest.cosmetics[name] = relUrl;

    if (fs.existsSync(filePath)) {
      cosmeticsCount++;
      continue;
    }

    const item = await getWikiThumbnail(wikiTitle);
    if (item && item.buf) {
      fs.writeFileSync(filePath, item.buf);
      cosmeticsCount++;
      console.log(`[Cosmetics] ${name} -> saved from ${item.url.slice(0, 45)}...`);
    } else {
      console.warn(`[Cosmetics] WARNING: could not fetch ${name} (${wikiTitle})`);
    }
    await sleep(150);
  }
  console.log(`Cosmetics complete: ${cosmeticsCount} / ${Object.keys(COSMETICS_WIKI).length}`);

  // 5. GARDEN (38 items)
  console.log('\nProcessing Garden items...');
  const GARDEN_WIKI = {
    // Flowers
    'Rose': 'Rosa',
    'Marigold': 'Tagetes',
    'Jasmine': 'Jasmine',
    'Sunflower': 'Helianthus',
    'Lotus': 'Nelumbo_nucifera',
    'Hibiscus': 'Hibiscus',
    'Tulip': 'Tulip',
    'Lily': 'Lilium',
    'Daisy': 'Bellis_perennis',
    'Orchid': 'Orchidaceae',
    'Lavender': 'Lavandula',
    'Bougainvillea': 'Bougainvillea',
    'Chrysanthemum': 'Chrysanthemum',
    'Dahlia': 'Dahlia',
    // Veg
    'Tomato': 'Tomato',
    'Brinjal': 'Eggplant',
    'Okra': 'Okra',
    'Green chilli': 'Chili_pepper',
    'Carrot': 'Carrot',
    'Cabbage': 'Cabbage',
    'Cauliflower': 'Cauliflower',
    'Spinach': 'Spinach',
    'Pumpkin': 'Pumpkin',
    'Bottle gourd': 'Calabash',
    'Cucumber': 'Cucumber',
    'Corn': 'Maize',
    'Onion': 'Onion',
    'Peas': 'Pea',
    'Capsicum': 'Bell_pepper',
    'Potato': 'Potato',
    // Herbs
    'Tulsi': 'Ocimum_tenuiflorum',
    'Mint': 'Mentha',
    'Coriander': 'Coriander',
    'Curry leaf': 'Curry_tree',
    'Aloe vera': 'Aloe_vera',
    'Lemongrass': 'Cymbopogon',
    'Fenugreek': 'Fenugreek',
    'Ginger': 'Ginger',
  };

  let gardenCount = 0;
  for (const [name, wikiTitle] of Object.entries(GARDEN_WIKI)) {
    const slug = slugify(name);
    const filePath = path.join(PUBLIC_GAMIFY, 'garden', `${slug}.jpg`);
    const relUrl = `/images/gamify/garden/${slug}.jpg`;
    manifest.garden[name] = relUrl;

    if (fs.existsSync(filePath)) {
      gardenCount++;
      continue;
    }

    const item = await getWikiThumbnail(wikiTitle);
    if (item && item.buf) {
      fs.writeFileSync(filePath, item.buf);
      gardenCount++;
      console.log(`[Garden] ${name} -> saved from ${item.url.slice(0, 45)}...`);
    } else {
      console.warn(`[Garden] WARNING: could not fetch ${name} (${wikiTitle})`);
    }
    await sleep(150);
  }
  console.log(`Garden complete: ${gardenCount} / ${Object.keys(GARDEN_WIKI).length}`);

  // Write manifest.json
  const manifestPath = path.join(PUBLIC_GAMIFY, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nWritten manifest to ${manifestPath}`);

  // Write frontend/src/data/gamifyManifest.js
  const jsManifestPath = path.join(ROOT, 'frontend', 'src', 'data', 'gamifyManifest.js');
  const jsContent = `// Auto-generated curated asset manifest for Gamify Mode.
// Contains self-hosted paths under /images/gamify/ for all ~89 books, ~130 foods,
// 93 wardrobe items, 33 cosmetics items, and 38 garden plants.

export const GAMIFY_MANIFEST = ${JSON.stringify(manifest, null, 2)};

export const BOOK_COVERS = GAMIFY_MANIFEST.books;
export const FOOD_PHOTOS = GAMIFY_MANIFEST.foods;
export const WARDROBE_PHOTOS = GAMIFY_MANIFEST.wardrobe;
export const COSMETICS_PHOTOS = GAMIFY_MANIFEST.cosmetics;
export const GARDEN_PHOTOS = GAMIFY_MANIFEST.garden;
`;
  fs.writeFileSync(jsManifestPath, jsContent);
  console.log(`Written JS manifest to ${jsManifestPath}`);
  console.log('--- Asset Curation Completed Successfully ---');
}

run().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
