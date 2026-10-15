// Download and process space assets:
// 1. Planet textures & Milky Way panorama
// 2. Full star catalog (~9,000 stars)
// 3. All 88 constellations with lines & metadata

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SPACE_DIR = path.join(ROOT, 'frontend', 'public', 'images', 'gamify', 'space');
fs.mkdirSync(SPACE_DIR, { recursive: true });

const UA = 'SahaPlay/1.0 (https://sahaplay.com; contact@sahaplay.com)';

async function fetchBufferWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 20000);
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctl.signal });
      clearTimeout(t);
      if (res.ok) {
        return Buffer.from(await res.arrayBuffer());
      }
    } catch (e) {}
    await new Promise(r => setTimeout(r, 600));
  }
  return null;
}

async function run() {
  console.log('--- Curating Space Viewer Assets ---');

  // 1. Planet Textures & Milky Way Panorama
  const TEXTURES = [
    ['sun.jpg', 'Solarsystemscope texture 2k sun.jpg'],
    ['mercury.jpg', 'Solarsystemscope texture 2k mercury.jpg'],
    ['venus.jpg', 'Solarsystemscope texture 2k venus atmosphere.jpg'],
    ['earth.jpg', 'Solarsystemscope texture 2k earth daymap.jpg'],
    ['moon.jpg', 'Solarsystemscope texture 2k moon.jpg'],
    ['mars.jpg', 'Solarsystemscope texture 2k mars.jpg'],
    ['jupiter.jpg', 'Solarsystemscope texture 2k jupiter.jpg'],
    ['saturn.jpg', 'Solarsystemscope texture 2k saturn.jpg'],
    ['saturn_ring.png', 'Solarsystemscope texture 2k saturn ring alpha.png'],
    ['uranus.jpg', 'Solarsystemscope texture 2k uranus.jpg'],
    ['neptune.jpg', 'Solarsystemscope texture 2k neptune.jpg'],
    ['milkyway.jpg', 'Solarsystemscope texture 2k stars milky way.jpg'],
  ];

  for (const [targetName, wikiFilename] of TEXTURES) {
    const targetPath = path.join(SPACE_DIR, targetName);
    if (fs.existsSync(targetPath)) {
      console.log(`[Texture] Already exists: ${targetName}`);
      continue;
    }
    const url = `https://en.wikipedia.org/wiki/Special:FilePath/${encodeURIComponent(wikiFilename)}?width=1024`;
    const buf = await fetchBufferWithRetry(url);
    if (buf) {
      fs.writeFileSync(targetPath, buf);
      console.log(`[Texture] Saved ${targetName} (${buf.length} bytes)`);
    } else {
      console.error(`[Texture] FAILED to download ${targetName}`);
    }
  }

  // 2. Star Names
  console.log('\nFetching Star Names...');
  const starNamesRes = await fetch('https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/starnames.json');
  const starNames = await starNamesRes.json();

  // 3. Star Catalog (~9,000 stars)
  console.log('Fetching Star Catalog...');
  const stars8Res = await fetch('https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/stars.8.json');
  const stars8 = await stars8Res.json();

  // Filter to naked-eye stars (mag <= 6.55) -> ~9,000 stars
  const catalog = [];
  for (const f of stars8.features) {
    const mag = f.properties?.mag;
    if (mag === undefined || mag > 6.55) continue;
    const [ra, dec] = f.geometry.coordinates; // ra in hours, dec in degrees
    const id = String(f.id);
    const meta = starNames[id] || {};
    const name = meta.name || meta.bayer || meta.flam || meta.var || '';
    const desig = meta.desig ? `${meta.desig} ${meta.c || ''}`.trim() : (meta.c ? `${meta.c} ${id}` : `HIP ${id}`);
    const bv = f.properties?.bv ? parseFloat(f.properties.bv) : 0.4;
    
    catalog.push({
      id: f.id,
      ra: Math.round(ra * 10000) / 10000,
      dec: Math.round(dec * 10000) / 10000,
      mag: Math.round(mag * 100) / 100,
      bv: Math.round(bv * 100) / 100,
      name,
      desig,
      con: meta.c || '',
    });
  }

  console.log(`Filtered stars count (mag <= 6.55): ${catalog.length}`);
  const starsJsonPath = path.join(SPACE_DIR, 'stars.json');
  fs.writeFileSync(starsJsonPath, JSON.stringify(catalog));
  console.log(`Saved ${starsJsonPath} (${fs.statSync(starsJsonPath).size} bytes)`);

  // 4. All 88 Constellations (metadata + line segments)
  console.log('\nFetching Constellations...');
  const constMetaRes = await fetch('https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.json');
  const constMeta = await constMetaRes.json();

  const constLinesRes = await fetch('https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.lines.json');
  const constLines = await constLinesRes.json();

  const linesMap = {};
  for (const f of constLines.features) {
    linesMap[f.id] = f.geometry.coordinates; // array of line coordinate segments
  }

  const constellations = constMeta.features.map(f => {
    const id = f.id;
    return {
      id,
      name: f.properties.name,
      en: f.properties.en,
      rank: parseInt(f.properties.rank || '99', 10),
      center: f.geometry.coordinates, // [ra, dec]
      lines: linesMap[id] || [],
    };
  });

  console.log(`Total Constellations processed: ${constellations.length}`);
  const constellationsJsonPath = path.join(SPACE_DIR, 'constellations.json');
  fs.writeFileSync(constellationsJsonPath, JSON.stringify(constellations));
  console.log(`Saved ${constellationsJsonPath} (${fs.statSync(constellationsJsonPath).size} bytes)`);

  console.log('--- Space Assets Curation Complete ---');
}

run().catch(e => {
  console.error('Space curation error:', e);
  process.exit(1);
});
