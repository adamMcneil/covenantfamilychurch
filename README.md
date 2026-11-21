# Covenant Family Church website

The website of Covenant Family Church (OPC, Wentzville, MO), rebuilt as a static site to replace the old WordPress site at covenantfamilychurch.net. It is built with [Eleventy](https://www.11ty.dev/) and published by GitHub Pages. Every push to `main` rebuilds and deploys the site in about a minute.

All 169 posts and 25 pages from the old site are here, at the same addresses (`/sunday/`, `/the-lords-supper-its-proper-recipients-1-corinthians/`, `/category/rev-serven/page/2/`, `/2009/03/`, …), so old links and search results keep working after the domain moves.

## Announcements editor

The pastor updates the weekly announcements in [Pages CMS](https://app.pagescms.org), a free web editor for sites stored on GitHub. It looks like a word processor, it does not need a GitHub account, and it shows him only the announcements. Each **Save** is a commit to `main`, so the site redeploys in about a minute. What the editor shows is set in `.pages.yml`.

One-time setup (repository owner):

1. Go to [app.pagescms.org](https://app.pagescms.org), sign in with GitHub, and install the Pages CMS GitHub App when asked, giving it access to this repository only.
2. Open the repository there and check the **Announcements** entry opens and shows this week's text.
3. In the repository's **Collaborators** settings in Pages CMS, invite the pastor's email address. He signs in with that address; Pages CMS emails him a code. No GitHub account or password is involved.

What he does each week: open app.pagescms.org, choose **Announcements**, replace last week's text (the date goes on the first line by itself, as on the old site), and save. Photos and flyers go in with the image button and are stored in `src/wp-content/uploads/announcements/`.

If a save doesn't show up on the site within a few minutes, the build failed: GitHub emails the repository owner, and the **Actions** tab shows why. The editor only manages `src/pages/announcements.md`'s title and text; the page's other data is in `src/pages/announcements.11tydata.js`, because Pages CMS rewrites the front matter from its form and drops anything else.

## Member directory

`/members/` lets church members download the directory PDF. A member enters their email, gets a code by email, and signs in. Only people you have added can sign in, and the file is in a private bucket that only signed-in members can read. It runs on a free [Supabase](https://supabase.com) project (sign-in and file storage), which the page talks to from the browser (`src/assets/js/members.js`). Until `members` in `src/_data/site.json` is filled in, the page says the directory isn't online yet.

One-time setup (menu names in the Supabase dashboard may differ slightly):

1. Create a free Supabase account and a project (region East US). Note the **Project URL** and the **publishable key** (Project Settings → API Keys). Both are meant to be public; the bucket's rules are what protect the file.
2. In the SQL Editor, run `supabase/setup.sql`. It creates the private `members` bucket, the members-only download rule, and the keepalive row.
3. Authentication → Sign In / Providers: turn off **Allow new users to sign up**, and keep the Email provider on. In the Email provider, set **Email OTP Length** to 8 and **Email OTP Expiration** to 900 seconds (15 minutes), so codes are harder to guess and stop working sooner. Invitation links use the same expiry; someone who opens theirs later just asks for a code on the page.
4. Authentication → Emails → SMTP Settings: turn on custom SMTP with the church mailbox (IONOS: host `smtp.ionos.com`, port 587, the mailbox address and its password) and sender name "Covenant Family Church". Supabase's built-in sender only mails the project's own team.
5. Authentication → Emails → Templates:
   - **Magic link**: subject "Your sign-in code for the Covenant Family Church directory", with `{{ .Token }}` in the body. The token is what makes it send a code instead of a link.
   - **Invite user**: say they have been added to the member directory, with a link to `{{ .ConfirmationURL }}`.
   - **Confirm signup**: also include `{{ .Token }}`. Someone invited who didn't use the invitation link within the hour gets this email, not the magic link one, the first time they ask for a code.
6. Authentication → URL Configuration: set the Site URL to `https://adammcneil.github.io/covenantfamilychurch/members/` (`https://covenantfamilychurch.net/members/` after the domain move). Invitation links land there.
7. Storage → `members`: upload the directory as `directory.pdf`.
8. Put the Project URL and publishable key in `src/_data/site.json` under `members`, then push.

Running it:

- **Add a member**: Authentication → Users → Add user → Send invitation, with their email.
- **Remove a member**: delete them under Authentication → Users. They can't sign in again; a sign-in already open lasts at most an hour.
- **New directory**: upload it to the `members` bucket as `directory.pdf`, replacing the old one.
- **Keeping it awake**: Supabase pauses free projects after a week without activity, so `.github/workflows/supabase-keepalive.yml` reads a row twice a week. If the project pauses anyway, restore it from the Supabase dashboard. GitHub turns scheduled workflows off after 60 days without commits; the weekly announcements keep it on.

## Common edits

You can make all of these in the GitHub web editor (open the file, click the pencil, then **Commit changes**). The site redeploys on its own.

| To change | Edit |
| --- | --- |
| This week's announcements | The [announcements editor](#announcements-editor), or `src/pages/announcements.md` (the home page shows its date line and first paragraph) |
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

The form on `/contact/` (and on the Men's Advance and Pilgrim Heritage pages) sends its message through [Web3Forms](https://web3forms.com), a free service (250 messages a month) that emails each message to the inbox of the Web3Forms account that owns the form. The email's subject is "Message from the Covenant Family Church website", and **Reply** goes to the visitor. Sent messages are also kept in that account's dashboard at [app.web3forms.com](https://app.web3forms.com). If `contactForm` in `src/_data/site.json` is ever emptied, pressing **Send message** opens the visitor's email app instead, with the message addressed to the email in `site.json`.

To send the messages to a different inbox:

1. Sign in at [app.web3forms.com](https://app.web3forms.com) with the address that should receive them. It asks you to tick a "Verify you are human" box and emails you a sign-in code; signing in the first time creates the account.
2. Create a form (any name; the website address is the contact page). The next page shows its **Form Access Key**.
3. Put that key in `src/_data/site.json` as `contactForm.accessKey` (keep `"action": "https://api.web3forms.com/submit"`), then push. The key is meant to be public; it only lets the form send to that one inbox.
4. Send yourself a test message from `/contact/` once the site has redeployed.

Web3Forms only accepts messages sent from a visitor's browser, so it can't be tested with `curl`. If a message doesn't go through, the form tells the visitor to use the email in `site.json` instead.

**Spam protection.** Visitors tick an hCaptcha "I am human" box before sending. The box only appears when `contactForm.hcaptchaSiteKey` is set; `50b2fe65-b00b-4b9e-ad62-3ba471098be2` is the shared key Web3Forms gives free accounts. Spam bots don't need the page (the access key is public), so the check that matters happens at Web3Forms: in the form's settings at [app.web3forms.com](https://app.web3forms.com), hCaptcha must be chosen as the spam protection. With that on, Web3Forms rejects any message without a ticked box. Turn it on after deploying a page with the box, or real messages are rejected in between. A form made for a new inbox needs it turned on again.

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

`scripts/import-wordpress.mjs` is what converted the old site. While the WordPress site is still up, you can pull a page or post again by its slug:

```sh
npm run import -- --only ministries
```

Don't re-import `announcements`: it is now written in the announcements editor, not WordPress. Re-importing overwrites that file, so hand edits to it are lost. Without `--only` it re-imports everything; some pages were tidied by hand after the import (Leadership's headings, the Truth, Vision and Roots titles), so prefer `--only`.
