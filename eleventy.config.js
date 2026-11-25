import { EleventyHtmlBasePlugin } from '@11ty/eleventy';
import { feedPlugin } from '@11ty/eleventy-plugin-rss';
import fs from 'node:fs';
import path from 'node:path';

const site = JSON.parse(fs.readFileSync('src/_data/site.json', 'utf8'));
const categories = JSON.parse(fs.readFileSync('src/_data/categoryList.json', 'utf8'));
const tags = JSON.parse(fs.readFileSync('src/_data/tagList.json', 'utf8'));
const authors = JSON.parse(fs.readFileSync('src/_data/authorList.json', 'utf8'));

const PER_PAGE = 10;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = n => String(n).padStart(2, '0');

// Dates in front matter are the old site's local wall-clock times with no zone,
// which Eleventy reads as UTC. Format them in UTC so they print as written.
const fmt = (d, opts) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...opts }).format(d);

// Split a list of posts into WordPress-style pages: /base/, /base/page/2/, ...
function paginate(posts, base, meta) {
  const total = Math.max(1, Math.ceil(posts.length / PER_PAGE));
  const out = [];
  for (let i = 0; i < total; i++) {
    out.push({
      ...meta,
      posts: posts.slice(i * PER_PAGE, (i + 1) * PER_PAGE),
      pageNumber: i + 1,
      totalPages: total,
      url: i === 0 ? base : `${base}page/${i + 1}/`,
      prevUrl: i === 0 ? null : i === 1 ? base : `${base}page/${i}/`,
      nextUrl: i + 1 < total ? `${base}page/${i + 2}/` : null,
    });
  }
  return out;
}

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(EleventyHtmlBasePlugin);

  eleventyConfig.addPlugin(feedPlugin, {
    type: 'rss',
    outputPath: '/feed.xml',
    collection: { name: 'postsOldestFirst', limit: 20 }, // the plugin reverses it
    metadata: {
      language: 'en',
      title: site.title,
      subtitle: site.description,
      base: site.url + '/',
      author: { name: site.title },
    },
  });

  eleventyConfig.addPassthroughCopy({ 'src/wp-content': 'wp-content' });
  eleventyConfig.addPassthroughCopy({ 'src/assets': 'assets' });
  // Browser and home-screen icons live at the site root, where browsers look for them.
  eleventyConfig.addPassthroughCopy({ 'src/icons/*': '/' });
  eleventyConfig.addPassthroughCopy({ 'src/.nojekyll': '.nojekyll' });

  eleventyConfig.amendLibrary('md', md => md.set({ html: true, breaks: false, linkify: false, typographer: false }));

  // ----- Collections -----

  const byDateDesc = (a, b) => b.date - a.date;
  const allPosts = api => api.getFilteredByGlob('src/posts/*.md').sort(byDateDesc);

  eleventyConfig.addCollection('posts', allPosts);
  eleventyConfig.addCollection('postsOldestFirst', api => allPosts(api).reverse());

  eleventyConfig.addCollection('archivePages', api => {
    const posts = allPosts(api);
    const pages = [];

    pages.push(...paginate(posts, '/weblog/', {
      kind: 'blog', title: 'Blog', heading: 'All posts',
    }));

    for (const c of categories) {
      const list = posts.filter(p => (p.data.categories || []).includes(c.slug));
      if (list.length) pages.push(...paginate(list, `/category/${c.slug}/`, {
        kind: 'category', title: c.name, heading: `Category: ${c.name}`, description: c.description,
      }));
    }
    for (const t of tags) {
      const list = posts.filter(p => (p.data.wpTags || []).includes(t.slug));
      if (list.length) pages.push(...paginate(list, `/tag/${t.slug}/`, {
        kind: 'tag', title: t.name, heading: `Tagged: ${t.name}`,
      }));
    }
    for (const a of authors) {
      const list = posts.filter(p => p.data.author === a.slug);
      pages.push(...paginate(list, `/author/${a.slug}/`, {
        kind: 'author', title: a.name, heading: `Posts by ${a.name}`, description: a.description,
      }));
    }

    const years = new Map(), months = new Map();
    for (const p of posts) {
      const y = p.date.getUTCFullYear(), m = p.date.getUTCMonth();
      if (!years.has(y)) years.set(y, []);
      years.get(y).push(p);
      const key = `${y}/${pad(m + 1)}`;
      if (!months.has(key)) months.set(key, { y, m, list: [] });
      months.get(key).list.push(p);
    }
    for (const [y, list] of years) pages.push(...paginate(list, `/${y}/`, {
      kind: 'year', title: String(y), heading: `Posts from ${y}`,
    }));
    for (const [key, { y, m, list }] of months) pages.push(...paginate(list, `/${key}/`, {
      kind: 'month', title: `${MONTHS[m]} ${y}`, heading: `Posts from ${MONTHS[m]} ${y}`,
    }));
    return pages;
  });

  // Sidebar archive list: one entry per month that has posts, newest first.
  eleventyConfig.addCollection('monthArchive', api => {
    const seen = new Map();
    for (const p of allPosts(api)) {
      const y = p.date.getUTCFullYear(), m = p.date.getUTCMonth();
      const key = `${y}/${pad(m + 1)}`;
      if (!seen.has(key)) seen.set(key, { url: `/${key}/`, label: `${MONTHS[m]} ${y}`, count: 0 });
      seen.get(key).count++;
    }
    return [...seen.values()];
  });

  // ----- Filters -----

  eleventyConfig.addFilter('displayDate', d => fmt(d, { month: 'long', day: 'numeric', year: 'numeric' }));
  eleventyConfig.addFilter('shortDate', d => fmt(d, { month: 'short', day: 'numeric', year: 'numeric' }));
  eleventyConfig.addFilter('isoDate', d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`);
  eleventyConfig.addFilter('categoryName', slug => categories.find(c => c.slug === slug)?.name || slug);
  eleventyConfig.addFilter('tagName', slug => tags.find(t => t.slug === slug)?.name || slug);
  eleventyConfig.addFilter('authorName', slug => authors.find(a => a.slug === slug)?.name || slug);
  eleventyConfig.addFilter('audioUrl', p => /^https?:/.test(p) ? p : site.audioBase.replace(/\/?$/, '/') + p);
  eleventyConfig.addFilter('fileName', p => decodeURIComponent(String(p).split('/').pop()));
  eleventyConfig.addFilter('truncateWords', (text = '', n = 55) => {
    const words = String(text).split(/\s+/);
    return words.length > n ? words.slice(0, n).join(' ') + '…' : text;
  });
  // Plain-text summary for lists and meta descriptions.
  eleventyConfig.addFilter('summary', (item, n = 55) => {
    const raw = item.data.excerpt || (item.rawInput || '')
      .replace(/^#{1,6} .*$/gm, ' ')
      .replace(/<[^>]+>/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#*_>\\`]/g, ' ');
    const words = raw.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    return words.length > n ? words.slice(0, n).join(' ') + '…' : words.join(' ');
  });
  // Use a smaller WordPress-generated copy (name-300x200.jpg) when one exists on disk.
  // minSide is the shortest edge the crop needs (square thumbnails crop to it).
  eleventyConfig.addFilter('thumb', (src, minSide = 300) => {
    if (!src || !src.startsWith('/wp-content/')) return src;
    const dir = path.join('src', path.dirname(src));
    const ext = path.extname(src), base = path.basename(src, ext);
    let best = null;
    for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
      const m = f.match(/^(.*)-(\d+)x(\d+)(\.[a-z]+)$/i);
      if (!m || m[1] !== base || m[4].toLowerCase() !== ext.toLowerCase()) continue;
      const w = Number(m[2]), short = Math.min(w, Number(m[3]));
      if (short >= minSide && (!best || w < best.w)) best = { w, f };
    }
    return best ? `${path.dirname(src)}/${best.f}` : src;
  });
  // Plain-text paragraphs of a Markdown page, for teasers.
  eleventyConfig.addFilter('paragraphs', item => String(item?.rawInput || '')
    .split(/\n\s*\n/)
    .map(b => b.replace(/<[^>]+>/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_#>`]|\\$/gm, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean));
  // First paragraph long enough to be real prose (skips dates, greetings, headings).
  eleventyConfig.addFilter('selectLead', paras => (paras || []).find(p => p.split(' ').length >= 12) || '');
  eleventyConfig.addFilter('year', () => new Date().getFullYear());
  eleventyConfig.addFilter('findByUrl', (collection, url) => collection.find(p => p.url === url));
  eleventyConfig.addFilter('navActive', (item, url) =>
    item.url === url || (item.children || []).some(c => c.url === url));
  // Previous/next post links on single posts (collection is newest first).
  eleventyConfig.addFilter('neighbors', (collection, url) => {
    const i = collection.findIndex(p => p.url === url);
    return { newer: i > 0 ? collection[i - 1] : null, older: i >= 0 && i < collection.length - 1 ? collection[i + 1] : null };
  });
}

export const config = {
  dir: { input: 'src', output: '_site', includes: '_includes', data: '_data' },
  templateFormats: ['md', 'njk'],
  markdownTemplateEngine: false,
  htmlTemplateEngine: 'njk',
  // GitHub Pages project sites live under /<repo>/; the deploy workflow sets this.
  pathPrefix: process.env.PATH_PREFIX || '/',
};
