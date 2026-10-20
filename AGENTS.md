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
- One commit per tool or per logical change, with a clear English commit message.

## Structure

```
/                       bilingual home (lists every tool)
/zh-tw/                 Chinese home (Traditional Chinese, Taiwan)
/zh-tw/<category>/<tool-slug>/index.html + tool.js
/en/                    English home
/en/<category>/<tool-slug>/index.html + tool.js
/zh-tw/{about,privacy,contact}/   site pages (same under /en/)
/assets/site.css        shared design tokens and components
/assets/site.js         language choice, theme toggle, copy buttons
/assets/affiliates.js   affiliate products per tool (see "Affiliate slots")
/tests/                 node tests for tool logic
sitemap.xml, robots.txt, 404.html, .nojekyll
```

Current categories: `zh-tw/life` (生活工具), `en/electronics`.
Slugs are lowercase English words joined with hyphens, describing what people search for.

## Adding a new tool – checklist

1. Create `/<lang>/<category>/<slug>/index.html` by copying an existing tool page. Keep the header, footer,
   font links and theme script identical.
2. Put logic in `tool.js` next to it, in this shape:
   - a pure-logic object at the top (no DOM access), exported with
     `if (typeof module !== 'undefined') module.exports = X;`
   - DOM wiring inside `if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', ...)`
3. Add tests in `/tests/<slug>.test.js` and run `node tests/run.js`. All tests must pass.
4. Page content, in this order: `.page-head` (breadcrumb, h1, one-sentence description) → one or more
   `.tool` panels → affiliate slot `<aside>` (see below) → `.article` with an explanation, a reference table where useful,
   and a short FAQ (2–4 questions people actually search for).
5. SEO in `<head>`: unique `<title>` (tool name + what it does + "- ToolLamp"), meta description under
   ~155 characters, canonical URL, `WebApplication` JSON-LD. If the tool exists in both languages, add the
   `hreflang` links to both versions (see "Languages").
6. Add the tool to the language home page AND the root `index.html`, and add its URL to `sitemap.xml`.
   Add an empty slot for its slug to `SLOTS` in `/assets/affiliates.js` (the tests check this).
7. The tool must show a useful result on first load (pre-fill a sensible default) and update live as the user types.

## Languages

- The root page `/` only redirects: `site.js` sends the reader to `/zh-tw/` or `/en/`. Its bilingual content is the
  no-JS fallback. No other page redirects by language, so search engines can index both versions.
- Language rule (`SiteLang` in `site.js`, tested in `tests/site-lang.test.js`): a saved choice wins. Otherwise the first
  Chinese entry in the browser languages decides: Traditional or TW/HK/MO → Chinese, Simplified or CN/SG/MY → English.
  With no Chinese entry, a Taipei/Hong Kong/Macau time zone → Chinese, anything else → English.
- The choice is saved in localStorage (`tb-lang`) only when the reader clicks a link with `data-set-lang`
  (the header's 中文工具 / English tools links and the offer bar).
- Pages that exist in both languages list each other with `<link rel="alternate" hreflang="zh-Hant|en">`
  right after the canonical link, with the same set on both pages. On those pages `site.js` shows a bar offering the
  other version when it matches the reader's language better. The tests check the links are reciprocal.
- The logo links to the home page of the page's language (`/zh-tw/` or `/en/`); only the root page and 404 link to `/`.

## Site pages and privacy

- Every page's footer links to the about, privacy and contact pages in its language
  (the root page and 404 link both languages). Every page except 404 is in `sitemap.xml`. The tests check both.
- The privacy pages (`/zh-tw/privacy/`, `/en/privacy/`) must match what the site really does. Before adding anything
  that collects or shares data (ads, analytics, cookies, a new third-party resource), update both privacy pages
  and their "last updated" date in the same commit.

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
Light and dark mode must both work. Keep layouts usable at 360 px wide. Don't add animations.

## Affiliate slots

All recommended products live in `/assets/affiliates.js`, in `SLOTS`, keyed by the tool's slug.
Each slot holds 0–3 items `{ name, url, note }` (`note` is one sentence on why it's recommended).
Every tool page has `<aside class="affiliate" data-slot="<slug>" hidden></aside>` below the tool panels and loads
`/assets/affiliates.js`; the script fills the slot and shows it only when it has items, adding the heading,
`rel="sponsored noopener" target="_blank"` and the disclosure line in the page's language. Don't edit the HTML.

Only the owner decides which products and links go there, and only programs marked "已核准" in PLAN.md may be used.
When asked to fill one, only edit that slot's array in `affiliates.js`, using the exact URLs the owner gives.
Never invent affiliate URLs or tracking IDs.
