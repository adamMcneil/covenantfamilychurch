// Checks the built site in _site/:
//  1. every URL of the old WordPress site (scripts/old-urls.txt) still exists
//  2. every internal link, image, script and stylesheet points at a file that exists
// Usage: npm run build && npm run check
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SITE = path.join(ROOT, '_site');
const prefix = (process.env.PATH_PREFIX || '/').replace(/\/?$/, '/');

const exists = urlPath => {
  let p = decodeURIComponent(urlPath.split('#')[0].split('?')[0]);
  if (!p.startsWith(prefix)) return false;
  p = p.slice(prefix.length - 1);
  const file = path.join(SITE, p);
  if (p.endsWith('/')) return fs.existsSync(path.join(file, 'index.html'));
  return fs.existsSync(file) || fs.existsSync(path.join(file, 'index.html'));
};

let failures = 0;
const fail = msg => { failures++; console.log('  ' + msg); };

console.log('Old WordPress URLs:');
const oldUrls = fs.readFileSync(path.join(ROOT, 'scripts/old-urls.txt'), 'utf8').split('\n').filter(Boolean);
for (const u of oldUrls) if (!exists(prefix.slice(0, -1) + u)) fail(`missing page ${u}`);
console.log(`  checked ${oldUrls.length}`);

console.log('Internal links and assets:');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? (e.name === 'pagefind' ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)]);
const htmlFiles = walk(SITE).filter(f => f.endsWith('.html'));
const broken = new Map();
let refs = 0;
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const pageUrl = '/' + path.relative(SITE, file).replace(/index\.html$/, '').replace(/\\/g, '/');
  for (const m of html.matchAll(/\s(?:href|src|action)="([^"]+)"/g)) {
    let u = m[1].replace(/&amp;/g, '&');
    if (/^(?:[a-z]+:|\/\/|#|data:)/i.test(u)) continue; // external, mailto, tel, anchors
    if (!u.startsWith('/')) u = new URL(u, 'http://x' + prefix + pageUrl.slice(1)).pathname;
    refs++;
    if (!exists(u)) {
      if (!broken.has(u)) broken.set(u, []);
      broken.get(u).push(pageUrl);
    }
  }
}
for (const [u, pages] of broken) fail(`${u}  (linked from ${pages.slice(0, 3).join(', ')}${pages.length > 3 ? ` and ${pages.length - 3} more` : ''})`);
console.log(`  checked ${refs} references in ${htmlFiles.length} pages`);

console.log(failures ? `\n${failures} problem(s) found.` : '\nAll good.');
process.exit(failures ? 1 : 0);
