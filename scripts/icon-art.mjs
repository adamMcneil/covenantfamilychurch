// Makes the site's decorative pictures from Tabler Icons (https://tabler.io/icons, MIT license,
// copies and license in scripts/icons/) and saves them over the old WordPress image addresses,
// replacing the stock photos the old site used there. Run with `npm run icon-art`.
//
// Each picture is one gilt icon on the navy of the site's header. To change one, pick another
// icon on tabler.io, save its outline SVG in scripts/icons/, and name it in `pictures` below.
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const uploads = `${root}src/wp-content/uploads/2019/01/`;

const navyDeep = '#1a2544', navy = '#26345c', glow = '#33457a', gilt = '#c9a45c';

// The drawing inside an icon file (its 24×24 paths, without the <svg> wrapper).
const icon = name => readFileSync(`${root}scripts/icons/${name}.svg`, 'utf8')
  .replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

// One icon on a navy canvas, `size` pixels tall, centred on (x, y), inside a thin gilt ring.
function canvas(w, h, name, { x = w / 2, y = h / 2, size = h * .5, stroke = 1.25, ring = true } = {}) {
  const s = size / 24, r = size * .86;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${navyDeep}"/><stop offset="1" stop-color="${navy}"/></linearGradient>
  <radialGradient id="light" cx="${x}" cy="${y}" r="${r * 1.6}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${glow}"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>
</defs>
<rect width="${w}" height="${h}" fill="url(#bg)"/>
<rect width="${w}" height="${h}" fill="url(#light)"/>
${ring ? `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${gilt}" stroke-opacity=".35" stroke-width="${Math.max(1, size / 90)}"/>` : ''}
<g transform="translate(${x - size / 2} ${y - size / 2}) scale(${s})" fill="none" stroke="${gilt}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${icon(name)}</g>
</svg>`;
}

// Home slides: the caption box covers the right part on desktop, and phones crop to 2:1 around
// the middle under the arrows, so the icon sits just left of centre.
const slide = h => ({ x: 370, size: h * .52 });
const card = { size: 54, stroke: 1.5 };

const pictures = {
  'FS-bible11.jpg': [960, 331, 'bible', slide(331)],
  'SL-family.jpg': [960, 331, 'home-heart', slide(331)],
  'FS-rooted.jpg': [960, 357, 'tree', slide(357)],

  'looking_church.png': [232, 117, 'building-church', card],
  'listen_sermon.png': [232, 117, 'headphones', card],
  'connect.png': [232, 117, 'messages', card],

  'news-link.png': [436, 278, 'news'],
  'blog_mast.png': [834, 233, 'feather', { x: 150, size: 110 }],

  'beliefs-1.png': [400, 263, 'building-bank'],
  'bible_compass.png': [445, 293, 'compass'],
  'bible_hourglass.png': [577, 381, 'seedling'],
  'bible_laptop.png': [469, 310, 'device-laptop'],
  'compass.png': [400, 264, 'users'],
  'distinctives.png': [400, 262, 'flame'],
  'faq_worship.png': [366, 366, 'pray', { size: 150 }],
  'generations.png': [453, 289, 'users-group'],
  'hourglass.png': [400, 262, 'hourglass'],
  'library.png': [400, 245, 'books'],
  'neighbors.png': [400, 264, 'building-community'],
  'pulpit.png': [400, 264, 'podium'],
  'searching.png': [400, 263, 'road'],
  'study.png': [400, 262, 'book'],
  'worship.png': [400, 263, 'music'],
};

for (const [file, [w, h, name, opts]] of Object.entries(pictures)) {
  const img = sharp(Buffer.from(canvas(w, h, name, opts)));
  if (file.endsWith('.jpg')) await img.jpeg({ quality: 88, mozjpeg: true }).toFile(uploads + file);
  else await img.png({ palette: true, quality: 90, compressionLevel: 9 }).toFile(uploads + file);
  console.log(file, '←', name);
}

// The home page hero: a faint scattering of the same icons, used as an SVG.
const heroIcons = ['bible', 'cross', 'building-church', 'book', 'music', 'tree', 'pray', 'flame'];
const cell = 120, cols = 14, rows = 6;
let tiles = '';
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
  const name = heroIcons[(r * 3 + c) % heroIcons.length];
  const x = c * cell + (r % 2 ? cell / 2 : 0) + 34, y = r * cell + 34;
  tiles += `<g transform="translate(${x} ${y}) scale(2.2)">${icon(name)}</g>`;
}
writeFileSync(`${root}src/assets/img/hero-icons.svg`,
  `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cell}" height="${rows * cell}" viewBox="0 0 ${cols * cell} ${rows * cell}" preserveAspectRatio="xMidYMid slice">
<g fill="none" stroke="${gilt}" stroke-opacity=".12" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">${tiles}</g>
</svg>
`);
