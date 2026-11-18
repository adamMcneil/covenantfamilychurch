// One-time importer: pulls every post and page from the old WordPress site's
// REST API and writes them as Markdown files with front matter.
//
//   node scripts/import-wordpress.mjs            fetch from the live site
//   node scripts/import-wordpress.mjs --cached   reuse .import-cache/ from a previous run
//   node scripts/import-wordpress.mjs --only announcements   re-import just these slugs
//
// It overwrites src/posts/*.md and src/pages/*.md (except hand-made pages listed in
// HANDMADE), rewrites src/_data/{categoryList,tagList,authorList}.json, and downloads any
// image under /wp-content/uploads/ that is not already in src/wp-content/uploads/.
// Hand edits to imported files are lost if you re-import them, so use --only.

import fs from 'node:fs';
import path from 'node:path';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import sharp from 'sharp';

const SITE = 'https://covenantfamilychurch.net';
const API = `${SITE}/wp-json/wp/v2`;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'src');
const CACHE = path.join(ROOT, '.import-cache');
const AUDIO_HOST = /^https?:\/\/(?:www\.)?download\.covenantfamilychurch\.net\//i;

// Pages rebuilt by hand as templates (src/*.njk); the importer leaves them alone.
const HANDMADE = new Set(['sunday', 'contact', 'weblog']);

// Links that were already broken on the old site, pointed at the page they meant.
const LINK_FIXES = {
  '/events/mens-advance-2014/': '/mens-advance-talks-2014/',
  '/join-us-this-sunday/': '/sunday/',
};

const args = process.argv.slice(2);
const useCache = args.includes('--cached');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? new Set(args.slice(onlyIdx + 1)) : null;

async function fetchAll(type) {
  const file = path.join(CACHE, `${type}.json`);
  if (useCache && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const items = [];
  for (let page = 1; ; page++) {
    const res = await fetch(`${API}/${type}?per_page=100&page=${page}`, { headers: { 'User-Agent': 'Mozilla/5.0 (site import)' } });
    if (res.status === 400) break; // past the last page
    if (!res.ok) throw new Error(`${type} page ${page}: HTTP ${res.status}`);
    const batch = await res.json();
    items.push(...batch);
    const totalPages = Number(res.headers.get('x-wp-totalpages') || 1);
    if (page >= totalPages) break;
  }
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(items));
  return items;
}

const decode = s => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&hellip;/g, '…')
  .replace(/&rsquo;/g, '’').replace(/&lsquo;/g, '‘').replace(/&rdquo;/g, '”').replace(/&ldquo;/g, '“')
  .replace(/&ndash;/g, '–').replace(/&mdash;/g, '—');

const stripTags = s => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

const yamlStr = s => JSON.stringify(String(s)); // JSON strings are valid YAML scalars

function frontMatter(obj) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue;
    if (Array.isArray(v)) lines.push(`${k}: [${v.map(yamlStr).join(', ')}]`);
    else if (typeof v === 'number' || typeof v === 'boolean') lines.push(`${k}: ${v}`);
    else if (v instanceof RawYaml) lines.push(`${k}: ${v.value}`);
    else lines.push(`${k}: ${yamlStr(v)}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}
class RawYaml { constructor(value) { this.value = value; } }

// ---------- HTML clean-up before Markdown conversion ----------

const missingUploads = new Set();
let idToPath = new Map();

function localUrl(url) {
  // Absolute links to the old site become site-relative, so they keep working on the new host.
  return url
    .replace(/^https?:\/\/(?:www\.)?covenantfamilychurch\.net(?=\/|$)/i, '')
    .replace(/^\/\/(?:www\.)?covenantfamilychurch\.net(?=\/|$)/i, '') || '/';
}

function rewriteIdLinks(url) {
  const m = url.match(/^\/?\?(?:p|page_id)=(\d+)/);
  if (m && idToPath.has(Number(m[1]))) return idToPath.get(Number(m[1]));
  return url;
}

function cleanHtml(html) {
  let h = html;
  h = h.replace(/<style\b[\s\S]*?<\/style>/gi, '');
  h = h.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  h = h.replace(/<noscript\b[\s\S]*?<\/noscript>/gi, '');
  h = h.replace(/<div class="wpforms-container[\s\S]*?<\/form><\/div>(?:<!-- \.wpforms-container -->)?/gi, '');
  h = h.replace(/\s(?:srcset|sizes|decoding|loading|data-[a-z-]+)="[^"]*"/gi, '');
  h = h.replace(/\b(href|src)=(["'])(.*?)\2/gi, (_, attr, q, url) => {
    let u = localUrl(decode(url));
    u = rewriteIdLinks(u);
    u = LINK_FIXES[u] || u;
    if (AUDIO_HOST.test(u)) u = u.replace(AUDIO_HOST, 'https://download.covenantfamilychurch.net/');
    return `${attr}="${u.replace(/"/g, '&quot;')}"`;
  });
  return h;
}

// ---------- Turndown with rules for WordPress block markup ----------

function makeTurndown() {
  const td = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    strongDelimiter: '**',
    br: '\\',
  });
  td.use(gfm);

  const attr = (node, name) => node.getAttribute && node.getAttribute(name);
  const alignOf = node => {
    for (let n = node; n && n.getAttribute; n = n.parentNode) {
      const c = n.getAttribute('class') || '';
      const m = c.match(/\balign(left|right|center|wide|full)\b/);
      if (m) return m[1];
      if (/^(P|BODY)$/.test(n.nodeName)) break;
    }
    return '';
  };
  const imgHtml = (img, extraClass = '') => {
    const src = attr(img, 'src') || '';
    if (missingUploads.has(src)) return '';
    const alt = (attr(img, 'alt') || '').replace(/"/g, '&quot;');
    const w = attr(img, 'width'), h = attr(img, 'height');
    const cls = extraClass ? ` class="${extraClass}"` : '';
    return `<img src="${src}" alt="${alt}"${w ? ` width="${w}"` : ''}${h ? ` height="${h}"` : ''}${cls} loading="lazy">`;
  };

  // Images: aligned (floated) images stay as HTML so the float survives; others become Markdown.
  td.addRule('image', {
    filter: 'img',
    replacement: (_, node) => {
      const src = attr(node, 'src') || '';
      if (!src || missingUploads.has(src)) return '';
      const align = alignOf(node);
      const w = attr(node, 'width');
      if (align || (w && Number(w) < 500)) {
        return imgHtml(node, align ? `align${align}` : '');
      }
      const alt = (attr(node, 'alt') || '').replace(/[\[\]]/g, '');
      return `![${alt}](${src})`;
    },
  });

  // <figure> and old [caption] markup: keep as an HTML figure with a caption.
  td.addRule('figure', {
    filter: node => node.nodeName === 'FIGURE' || (node.nodeName === 'DIV' && /\bwp-caption\b/.test(node.className)),
    replacement: (_, node) => {
      const img = node.querySelector('img');
      if (!img || missingUploads.has(attr(img, 'src'))) {
        const t = node.textContent.trim();
        return t ? `\n\n${t}\n\n` : '';
      }
      const link = img.parentNode && img.parentNode.nodeName === 'A' ? attr(img.parentNode, 'href') : '';
      const capNode = node.querySelector('figcaption, .wp-caption-text');
      const caption = capNode ? capNode.innerHTML.trim() : '';
      const align = alignOf(node) || alignOf(img);
      const cls = ['figure', align ? `align${align}` : ''].filter(Boolean).join(' ');
      let inner = imgHtml(img);
      if (link) inner = `<a href="${link}">${inner}</a>`;
      return `\n\n<figure class="${cls}">${inner}${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>\n\n`;
    },
  });

  // Gutenberg buttons become styled links.
  td.addRule('button', {
    filter: node => node.nodeName === 'DIV' && /\bwp-block-button\b/.test(node.className) && !/\bwp-block-buttons\b/.test(node.className),
    replacement: (_, node) => {
      const a = node.querySelector('a');
      if (!a) return '';
      return `\n\n<p class="button-row"><a class="button" href="${attr(a, 'href')}">${a.textContent.trim()}</a></p>\n\n`;
    },
  });

  // Embeds (YouTube, Google Maps, SermonAudio) stay as responsive iframes.
  td.addRule('iframe', {
    filter: 'iframe',
    replacement: (_, node) => {
      const src = attr(node, 'src') || '';
      const kind = /youtube/.test(src) ? 'video' : /google\.com\/maps/.test(src) ? 'map' : 'tall';
      const title = attr(node, 'title') || (kind === 'video' ? 'Video' : kind === 'map' ? 'Map' : 'Embedded content');
      return `\n\n<div class="embed embed-${kind}"><iframe src="${src}" title="${title}" loading="lazy" allowfullscreen></iframe></div>\n\n`;
    },
  });

  // Columns: wrap so the layout can show them side by side on wide screens.
  td.addRule('columns', {
    filter: node => node.nodeName === 'DIV' && /\bwp-block-columns\b/.test(node.className),
    replacement: content => `\n\n<div class="columns">\n\n${content.trim()}\n\n</div>\n\n`,
  });
  td.addRule('column', {
    filter: node => node.nodeName === 'DIV' && /\bwp-block-column\b/.test(node.className),
    replacement: content => `\n\n<div class="column">\n\n${content.trim()}\n\n</div>\n\n`,
  });

  // Page bodies sit under the page's own <h1>. If the body uses <h1> itself,
  // every heading moves down one level so the hierarchy is kept.
  td.addRule('heading', {
    filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    replacement: (content, node) => {
      const text = content.replace(/\\\n/g, ' ').trim();
      if (!text) return '\n\n';
      const level = Math.min(6, Number(node.nodeName[1]) + (td.shiftHeadings ? 1 : 0));
      return `\n\n${'#'.repeat(level)} ${text}\n\n`;
    },
  });

  // Drop empty paragraphs WordPress uses as spacers.
  td.addRule('emptyP', {
    filter: node => node.nodeName === 'P' && !node.textContent.replace(/[\s ]/g, '') && !node.querySelector('img,iframe'),
    replacement: () => '\n\n',
  });

  return td;
}

function toMarkdown(td, html) {
  td.shiftHeadings = /<h1[\s>]/i.test(html);
  let md = td.turndown(cleanHtml(html));
  md = md.replace(/^\[\]\([^)]*\)$/gm, ''); // links that only wrapped a missing image
  md = md.replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return md + '\n';
}

// ---------- Images ----------

async function downloadUploads(htmlBlobs, extraPaths) {
  const wanted = new Set(extraPaths);
  for (const blob of htmlBlobs) {
    const cleaned = blob.replace(/\s(?:srcset|sizes)="[^"]*"/gi, '');
    for (const m of cleaned.matchAll(/(?:src|href)=["']((?:https?:)?\/\/(?:www\.)?covenantfamilychurch\.net\/wp-content\/uploads\/[^"']+|\/wp-content\/uploads\/[^"']+)["']/gi)) {
      wanted.add(localUrl(decode(m[1])).split('?')[0]);
    }
  }
  let fetched = 0;
  for (const p of wanted) {
    const dest = path.join(SRC, decodeURI(p));
    if (fs.existsSync(dest)) continue;
    const res = await fetch(SITE + p, { headers: { 'User-Agent': 'Mozilla/5.0 (site import)' } });
    if (!res.ok) { missingUploads.add(p); console.warn(`  missing on old site: ${p} (HTTP ${res.status})`); continue; }
    let buf = Buffer.from(await res.arrayBuffer());
    if (/\.(jpe?g|png)$/i.test(p) && buf.length > 400 * 1024) {
      const img = sharp(buf, { failOn: 'none' }).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true });
      const out = await (/\.png$/i.test(p) ? img.png({ compressionLevel: 9 }) : img.jpeg({ quality: 80, mozjpeg: true })).toBuffer();
      if (out.length < buf.length) buf = out;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    fetched++;
  }
  console.log(`images: ${wanted.size} referenced, ${fetched} downloaded, ${missingUploads.size} missing on the old site`);
}

// ---------- Main ----------

const [posts, pages, categories, tags, users, media] = await Promise.all(
  ['posts', 'pages', 'categories', 'tags', 'users', 'media'].map(fetchAll));
console.log(`fetched ${posts.length} posts, ${pages.length} pages, ${categories.length} categories, ${tags.length} tags, ${users.length} authors, ${media.length} media`);

idToPath = new Map([...posts, ...pages].map(p => [p.id, localUrl(p.link)]));
const mediaById = new Map(media.map(m => [m.id, m]));
const catById = new Map(categories.map(c => [c.id, c]));
const tagById = new Map(tags.map(t => [t.id, t]));
const userById = new Map(users.map(u => [u.id, u]));

const featuredPath = item => {
  const m = mediaById.get(item.featured_media);
  return m ? localUrl(m.source_url) : '';
};

await downloadUploads(
  [...posts, ...pages].map(p => p.content.rendered),
  [...posts, ...pages].map(featuredPath).filter(Boolean),
);

const td = makeTurndown();
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };

let nPosts = 0, nPages = 0;
for (const p of posts) {
  if (only && !only.has(p.slug)) continue;
  let html = p.content.rendered;
  const audio = [];
  html = html.replace(/\[podcast[^\]]*\]\s*([^\[\s]+?)\s*\[\/podcast\]/gi, (_, url) => {
    audio.push(decode(url).replace(AUDIO_HOST, ''));
    return '';
  });
  const excerpt = stripTags(p.excerpt.rendered.replace(/\[podcast[\s\S]*?\[\/podcast\]/gi, ''))
    .replace(/\s*(\[…\]|\[\.\.\.\]|Continue reading.*)$/i, '').trim();
  const body = toMarkdown(td, html);
  const fm = {
    title: decode(p.title.rendered),
    date: new RawYaml(p.date),
    author: userById.get(p.author)?.slug,
    categories: p.categories.map(id => catById.get(id)?.slug).filter(Boolean),
    wpTags: p.tags.map(id => tagById.get(id)?.slug).filter(Boolean),
    image: featuredPath(p) || undefined,
    audio: audio.length === 1 ? audio[0] : undefined,
    audioList: audio.length > 1 ? audio : undefined,
    excerpt: excerpt && !/^https?:/.test(excerpt) ? excerpt : undefined,
    wpId: p.id,
  };
  write(path.join(SRC, 'posts', `${p.slug}.md`), frontMatter(fm) + body);
  nPosts++;
}

for (const p of pages) {
  if (HANDMADE.has(p.slug)) continue;
  if (only && !only.has(p.slug)) continue;
  const fm = {
    title: decode(p.title.rendered),
    date: new RawYaml(p.date),
    modified: new RawYaml(p.modified),
    image: featuredPath(p) || undefined,
    contactForm: p.template === 'page-contact.php' ? true : undefined,
    wpId: p.id,
  };
  write(path.join(SRC, 'pages', `${p.slug}.md`), frontMatter(fm) + toMarkdown(td, p.content.rendered));
  nPages++;
}

if (!only) {
  write(path.join(SRC, '_data', 'categoryList.json'), JSON.stringify(
    categories.filter(c => c.count > 0).map(c => ({ slug: c.slug, name: decode(c.name), description: stripTags(c.description) })), null, 2) + '\n');
  write(path.join(SRC, '_data', 'tagList.json'), JSON.stringify(
    tags.filter(t => t.count > 0).map(t => ({ slug: t.slug, name: decode(t.name) })), null, 2) + '\n');
  write(path.join(SRC, '_data', 'authorList.json'), JSON.stringify(
    users.map(u => ({ slug: u.slug, name: decode(u.name), description: stripTags(u.description || '') })), null, 2) + '\n');
}

console.log(`wrote ${nPosts} posts and ${nPages} pages`);
