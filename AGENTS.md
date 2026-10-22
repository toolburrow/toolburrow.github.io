# ToolLamp – working guide for AI agents

ToolLamp is a free online tool site hosted on GitHub Pages at https://toollamp.github.io/.
Income comes from affiliate links (later possibly AdSense). Read this whole file before changing anything.

**Before any work, also read PLAN.md.** It holds the current phase, the task list, the status of every
affiliate/ad program, and the decision log. Work on the first unchecked task of the current phase,
check tasks off as you finish them, and update PLAN.md before the session ends.

## Hard rules

- **Plain static site.** HTML, CSS and vanilla JavaScript only. No frameworks, no build step, no npm dependencies.
  Every page must work by opening it straight from GitHub Pages.
- **Everything runs in the browser.** Never send user input anywhere. No analytics, trackers or third-party
  scripts unless the owner asks. The only external resource allowed is Google Fonts.
- **No secrets.** This repo is public. Never commit API keys, tokens, personal data or anything from the owner's employer.
- **Absolute paths from the site root** (`/assets/site.css`, `/en/...`). The site is served from the domain root.
- **Accuracy over features.** A tool that gives a wrong answer destroys trust. Every calculation must be covered
  by the tests in `tests/`.

## Git workflow

- Commit and push straight to `main`. No feature branches or pull requests; the owner reviews on `main`.
- `main` deploys to the live site immediately, so run `node tests/run.js` before every push.
  Never push if any test fails.
- GitHub Pages lets browsers cache files for 10 minutes, and a normal reload often keeps using a cached script.
  When you change a script or stylesheet that is already live, add or bump `?v=<n>` on its `<script src>` or
  `<link href>` in every page that loads it, so readers get the new file with the new page.
- One commit per tool or per logical change, with a clear English commit message.

## Structure

```
/                       bilingual home (lists every tool)
/zh-tw/                 Chinese home (Traditional Chinese, Taiwan)
/zh-tw/<category>/<tool-slug>/index.html
/en/                    English home
/en/<category>/<tool-slug>/index.html
/assets/tools/<tool-slug>.js   tool logic + page text in both languages, shared by both pages
/assets/elec.js         shared parsing, SI formatting and E24 values for electronics tools (load it before the tool script)
/zh-tw/{about,privacy,contact}/   site pages (same under /en/)
/assets/site.css        shared design tokens and components
/assets/site.js         language choice, theme toggle, copy buttons
/assets/affiliates.js   affiliate products per tool (see "Affiliate slots")
/assets/favorites.js    ☆ button on tool pages, "my favorites" on the language home pages (see "Favorites")
/tests/                 node tests for tool logic
sitemap.xml, robots.txt, 404.html, .nojekyll
google93ec6f7db77f90e7.html   Google Search Console verification. Never edit or delete it.
```

Current categories: `life` (生活工具 / Everyday), `finance` (理財工具 / Finance) and `electronics` (電子工具 / Electronics),
in both languages.
On the home pages, `electronics` tools are listed in three groups: 零件標示 / Part markings, 電路計算 / Circuit calculators
and 微控制器 / Microcontrollers. Add a new electronics tool to the group it fits, on all three home pages.
Slugs are lowercase English words joined with hyphens, describing what people search for.
The category and slug are the same in both languages, so `/zh-tw/x/y/` and `/en/x/y/` are the two versions of one tool.

## Adding a new tool – checklist

1. Every tool is built in both languages. Create `/zh-tw/<category>/<slug>/index.html` and
   `/en/<category>/<slug>/index.html` by copying an existing tool page in each language. Keep the header, footer,
   font links and theme script identical to other pages in that language. Only the root page and 404 have the
   bilingual footer; every other page has the single-language footer of its own language.
2. Put the logic in `/assets/tools/<slug>.js`, loaded by both pages, in this shape:
   - a pure-logic object at the top (no DOM access, no language), exported with
     `if (typeof module !== 'undefined') module.exports = X;`. Errors are codes such as `{ error: 'format' }`,
     never sentences.
   - `X.TEXT = { 'zh-tw': {...}, en: {...} }` with every string the script writes on the page, including error
     messages. Both languages must have the same keys (`tests/tool-text.test.js` checks). Use `null` for a line
     that only one language shows.
   - DOM wiring inside `if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', ...)`,
     starting with `var T = X.TEXT[document.documentElement.lang === 'en' ? 'en' : 'zh-tw'];`
3. Add tests in `/tests/<slug>.test.js` and run `node tests/run.js`. All tests must pass.
4. Page content, in this order: `.page-head` (breadcrumb, h1, one-sentence description) → one or more
   `.tool` panels → feedback line `<p class="feedback">` (copy it from another tool page in that language and change
   the prefilled address at the end of the link, see "Feedback form") → affiliate slot `<aside>` (see below) → `.article` with an explanation, a reference table where useful,
   and a short FAQ (2–4 questions people actually search for) → related tools
   `<nav class="tool-group" aria-labelledby="related-h">` (copy one from another tool page).
   The related list holds 2–4 hand-picked tools, the ones a reader of this tool is most likely to need next (any
   category). Each `<li>` is copied exactly from the language home page, and both language versions list the same
   tools in the same order (the tests check).
5. SEO in `<head>`: unique `<title>` (tool name + what it does + "- ToolLamp"), meta description under
   160 characters in English or 80 in Chinese (the tests count a full-width character as two), canonical URL, `hreflang` links to both versions (see "Languages"), Open Graph tags right after the
   `hreflang` links (`og:title` is the `<title>` without " - ToolLamp", `og:description` repeats the meta description,
   `og:url` is the canonical URL, shared image `/assets/og.png`), `WebApplication` JSON-LD.
   No FAQPage JSON-LD: Google only shows FAQ results for government and health sites.
   The three home pages (`/`, `/zh-tw/`, `/en/`) instead carry `WebSite` JSON-LD named "ToolLamp", so Google can show
   ToolLamp rather than GitHub as the site name (the tests check).
6. Add the tool to both language home pages AND the root `index.html`, and add both URLs to `sitemap.xml`.
   Add empty slots `zh-tw/<slug>` and `en/<slug>` to `SLOTS` in `/assets/affiliates.js` (the tests check this).
   Load `/assets/favorites.js` right after `affiliates.js` (the tests check this).
   Add the new tool to the related lists of the 2–3 tools it fits best, in both languages, replacing a weaker pick
   when a list already has 4.
7. Every `.tool` panel must show a useful result on first load (pre-fill a sensible default), and update live as the
   user types. A panel that starts empty looks broken.

## Languages

- The root page `/` only redirects: `site.js` sends the reader to `/zh-tw/` or `/en/`. Its bilingual content is the
  no-JS fallback. No other page redirects by language, so search engines can index both versions.
- Language rule (`SiteLang` in `site.js`, tested in `tests/site-lang.test.js`): a saved choice wins. Otherwise the first
  Chinese entry in the browser languages decides: Traditional or TW/HK/MO → Chinese, Simplified or CN/SG/MY → English.
  With no Chinese entry, a Taipei/Hong Kong/Macau time zone → Chinese, anything else → English.
- The choice is saved in localStorage (`tb-lang`) only when the reader clicks a link with `data-set-lang`
  (the header's 中文工具 / English tools links and the offer bar).
- Every tool and site page exists in both languages (the tests check). Pages list each other with `<link rel="alternate" hreflang="zh-Hant|en">`
  right after the canonical link, with the same set on both pages. On those pages `site.js` shows a bar offering the
  other version when it matches the reader's language better. The tests check the links are reciprocal.
- The logo links to the home page of the page's language (`/zh-tw/` or `/en/`); only the root page and 404 link to `/`.

## Site pages and privacy

- Every page's footer carries `<p>© 2026 ToolLamp</p>` just above the footer links (the tests check). The repo is
  all rights reserved (see `LICENSE`); don't add an open-source license without the owner's say.
- Every page's footer links to the about, privacy and contact pages in its language
  (the root page and 404 link both languages). Every page except 404 is in `sitemap.xml`. The tests check both.
- The privacy pages (`/zh-tw/privacy/`, `/en/privacy/`) must match what the site really does. Before adding anything
  that collects or shares data (ads, analytics, cookies, a new third-party resource), update both privacy pages
  and their "last updated" date in the same commit.

## Feedback form

Feedback goes to a Google Form the owner made (`https://docs.google.com/forms/d/e/1FAIpQLScLt-GhP0PLlylqvuapzdhkgqdP_ZWWgiKO7V0qs4SpOuw6zg/viewform`).
The site only links to it, opening in a new tab; never embed the form or post to it from a script, since that would send
input from our pages to a third party.

- Every tool page has `<p class="feedback">` right under its last `.tool` panel. Its link adds
  `?usp=pp_url&amp;entry.243321783=` plus the URL-encoded page path (`%2Fzh-tw%2Flife%2Fbmi-calculator%2F`), which fills
  in the form's "which tool" question. Never put the reader's tool input in the link. `tests/site.test.js` checks the
  link on every tool page and on both contact pages.
- Every footer has a 意見回饋 / Feedback link right after the contact link, prefilled the same way with that page's path
  (the 404 page links to the plain form, since its path is unknown). Readers looking for a way to report a problem
  scroll straight to the footer, so it's the link most of them see.
- The contact pages offer the form first and GitHub Issues second. The responses spreadsheet is private: never put its
  URL in the repo.
- The privacy pages describe the form. Update them if the form starts asking for more personal data.
- Responses land in the owner's Google Sheet "ToolLamp 意見回饋 / Feedback (回覆)" (find it by that title with the Google
  Drive or Sheets connector). Columns A–E come from the form; F 決議 (待處理 / 要做 / 不做 / 已完成), G 理由／備註 and
  H 處理日期 are the owner's. At the start of a session, if a Google connector is available, list the rows whose F is
  empty or 待處理 for the owner and let them decide; fill F–H only after they do. Never copy email addresses or other
  personal details from the sheet into the repo, PLAN.md or commit messages; summarize the feedback instead.

## Talking to the owner

- Always reply to the owner in Traditional Chinese (Taiwan), including summaries, questions and error reports.
  Code, commit messages and English page content stay in English.

## Writing style

- `zh-tw`: Traditional Chinese with Taiwan vocabulary (資料, 網路, 程式, 預設). Full-width punctuation（，。：）.
- `en`: plain, sentence case, no marketing language.
- Errors say what is wrong and how to fix it, e.g. 「這一天不存在，請檢查月份和日期。」
- Button labels describe the action (複製 / Copy).

## Design

Use only the tokens in `site.css` (`--bg`, `--surface`, `--text`, `--muted`, `--line`, `--accent`, `--lamp`, …).
Never hard-code colors except in content that represents a real-world color (e.g. resistor bands).
Circuit diagrams are inline SVG next to the inputs: wrap the SVG (`class="schematic"`, `role="img"` and an `aria-label`
describing the circuit) and the `.row` in `<div class="with-schematic">`; the styles are in `site.css` and draw in the
text color, so they work in both themes. Charts are inline SVG too, colored with tokens through classes.
A page may have one `<style>` block in `<head>` for rules only that tool uses. A rule that a second tool needs moves to
`site.css` instead of being copied (the tests check that no two tools share a page-level rule).
Light and dark mode must both work. Keep layouts usable at 360 px wide. Don't add animations.

## Favorites

`/assets/favorites.js` adds a ☆ button under the h1 of every tool page and a "我的收藏 / My favorites" list above the
tool groups on `/zh-tw/` and `/en/`. Nothing is in the HTML; the script builds it, so pages without JS show nothing.

- The list is stored in localStorage `tb-fav` as `<category>/<slug>` ids. It is shared by both languages, since the ids
  are the same; each home page shows the names from its own tool list, so a tool must be on the home page to show up.
- With no favorites, the home page box shows a one-line hint pointing to the ☆ button, so people can find the feature.
- Both the button and the list redraw on `pageshow` from the back/forward cache and on `storage` events, so going
  back to the home page after adding a tool shows it without a reload.
- "Copy favorites link" gives `/<lang>/?fav=<id>,<id>`. Opening it asks before adding anything, then removes `?fav=` from the address.
- No accounts and no server. The privacy pages describe this; update them if the stored data changes.

## Affiliate slots

All recommended products live in `/assets/affiliates.js`, in `SLOTS`, keyed by `<lang>/<slug>`
(for example `zh-tw/voltage-divider`), because each language uses its own programs (蝦皮 for zh-tw, AliExpress or Amazon for en).
Each slot holds 0–3 items `{ name, url, note }` (`note` is one sentence on why it's recommended).
Every tool page has `<aside class="affiliate" data-slot="<lang>/<slug>" hidden></aside>` below the tool panels and loads
`/assets/affiliates.js`; the script fills the slot and shows it only when it has items, adding the heading,
`rel="sponsored noopener" target="_blank"` and the disclosure line in the page's language. Don't edit the HTML.

Only the owner decides which products and links go there, and only programs marked "已核准" in PLAN.md may be used.
When asked to fill one, only edit that slot's array in `affiliates.js`, using the exact URLs the owner gives.
Never invent affiliate URLs or tracking IDs.

Every footer carries the affiliate disclosure line in its language, just above the copyright line (the root page and 404
carry both): 「部分頁面含有聯盟連結，透過連結購買時我們可能獲得少量分潤。」 / “Some pages contain affiliate links. We may
earn a small commission if you buy through them.” `tests/site.test.js` checks it. The privacy pages say which pages have
affiliate links (zh-tw pages, Shopee); update them when a new program's links go in.

## Ad slots

No page has ads yet. AdSense accepts `toollamp.github.io` as it is (`github.io` is on the Public Suffix List), so no own
domain is needed to apply. No ad code may be added until PLAN.md marks Google AdSense as 已核准. To verify the site while
it is under review, use the `google-adsense-account` meta tag or a root `ads.txt` with the publisher ID the owner gives,
not the ad script. `site.css` already defines `.ad-slot` so ads can go in later without the layout jumping.

- Markup: `<div class="ad-slot" data-label="廣告"></div>` on zh-tw pages, `data-label="Advertisement"` on en pages.
  The ad code goes inside. The slot reserves 300px (a 20px label + a 280px ad); don't set a smaller height, and never
  hide overflow, since a cut-off ad breaks AdSense policy.
- Positions, at most two per page:
  1. Below the tool panels: after the affiliate `<aside>`, before `.article`. Never between or inside `.tool` panels,
     so an ad is never mistaken for part of a result.
  2. Mid-article: inside `.article`, just before the second `<h2>`.
- Never put a slot in the header, footer, page head or next to buttons and inputs.
- Until AdSense is approved, no page contains a `.ad-slot` element (`tests/site.test.js` checks).
- Adding ads also means updating both privacy pages (AdSense uses cookies) and the footer line
  「不會上傳任何資料」/“nothing is uploaded” in the same commit.

