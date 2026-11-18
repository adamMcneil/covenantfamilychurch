# Covenant Family Church website

The website of Covenant Family Church (OPC, Wentzville, MO), rebuilt as a static site to replace the old WordPress site at covenantfamilychurch.net. It is built with [Eleventy](https://www.11ty.dev/) and published by GitHub Pages. Every push to `main` rebuilds and deploys the site in about a minute.

All 169 posts and 25 pages from the old site are here, at the same addresses (`/sunday/`, `/the-lords-supper-its-proper-recipients-1-corinthians/`, `/category/rev-serven/page/2/`, `/2009/03/`, …), so old links and search results keep working after the domain moves.

## Common edits

You can make all of these in the GitHub web editor (open the file, click the pencil, then **Commit changes**). The site redeploys on its own.

| To change | Edit |
| --- | --- |
| This week's announcements | `src/pages/announcements.md` (the home page shows its date line and first paragraph) |
| Service times, meeting place, phone, email, social links | `src/_data/site.json` (used by the home page, the Sunday page, and the footer) |
| Top menu | `src/_data/nav.json` |
| Footer text | `src/_data/footer.json` |
| Any other page | `src/pages/<address>.md` (for example `src/pages/leadership.md` is `/leadership/`) |
| Home page layout | `src/index.njk` |
| Sunday and Contact pages | `src/sunday.njk`, `src/contact.njk` |

Pages and posts are Markdown with a short header. A new post is a new file in `src/posts/`; its file name becomes its address:

```markdown
---
title: "Pilgrim Heritage Celebration 2027"
date: 2027-11-01T09:00:00
author: "peterjb"
categories: ["events"]
image: "/wp-content/uploads/2027/11/flyer.jpg"
---

Text of the post…
```

Images go in `src/wp-content/uploads/` (the old WordPress paths are kept so old image links work). Authors and categories are listed in `src/_data/authorList.json` and `src/_data/categoryList.json`.

## Contact form

The form on `/contact/` (and on the Men's Advance and Pilgrim Heritage pages) works now: when someone presses **Send message**, their email app opens with the message filled in, addressed to the email in `site.json`.

To have the form send email directly instead, sign up for a free form service and put its details in `src/_data/site.json` under `contactForm`:

- **Web3Forms**: enter the address that should receive messages at web3forms.com to get an access key, then set `"action": "https://api.web3forms.com/submit"` and `"accessKey": "<your key>"`.
- **Formspree**: create a form at formspree.io, then set `"action": "https://formspree.io/f/<form id>"` and leave `accessKey` empty.

## Sermon audio

The old sermon recordings (about 100 MP3s from 2008–2010, roughly 1.5 GB) are still hosted at `download.covenantfamilychurch.net`, which is on the same hosting account as the old WordPress site. Each sermon post plays its file from there. Before that hosting is cancelled, move the files somewhere else (for example SermonAudio, archive.org, or a storage bucket), keeping the same `2009/…mp3` folder layout, and change `audioBase` in `src/_data/site.json` to the new location.

## Moving covenantfamilychurch.net to this site

1. In this repository's **Settings → Pages**, enter `covenantfamilychurch.net` as the custom domain and turn on **Enforce HTTPS** once it is offered.
2. At the domain's DNS provider, point the root domain at GitHub Pages with four `A` records: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`. Point `www` at `adammcneil.github.io` with a `CNAME` record.
3. Leave the `download` record (the sermon audio) and any mail (`MX`) records as they are.

Nothing in the code needs to change: the deploy workflow reads the site's base path from GitHub, so links work both at `adammcneil.github.io/covenantfamilychurch/` and at the custom domain.

## Working on it locally

Requires Node 20 or newer.

```sh
npm ci
npm start          # preview at http://localhost:8080, reloads as you edit
npm run build      # build into _site/ and index it for search
npm run check      # confirm every old WordPress URL exists and every internal link resolves
```

Search is [Pagefind](https://pagefind.app/), which indexes the built site, so it only works after `npm run build`, not under `npm start`.

## Re-importing from WordPress

`scripts/import-wordpress.mjs` is what converted the old site. While the WordPress site is still up, you can pull a page or post again, for example after this week's announcements are posted there:

```sh
npm run import -- --only announcements
```

Re-importing overwrites that file, so hand edits to it are lost. Without `--only` it re-imports everything; some pages were tidied by hand after the import (Leadership's headings, the Truth, Vision and Roots titles), so prefer `--only`.
