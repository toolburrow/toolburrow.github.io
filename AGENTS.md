# Toolburrow – working guide for AI agents

Toolburrow is a free online tool site hosted on GitHub Pages at https://toolburrow.github.io/.
Income comes from affiliate links (later possibly AdSense). Read this whole file before changing anything.

## Hard rules

- **Plain static site.** HTML, CSS and vanilla JavaScript only. No frameworks, no build step, no npm dependencies.
  Every page must work by opening it straight from GitHub Pages.
- **Everything runs in the browser.** Never send user input anywhere. No analytics, trackers or third-party
  scripts unless the owner asks. The only external resource allowed is Google Fonts.
- **No secrets.** This repo is public. Never commit API keys, tokens, personal data or anything from the owner's employer.
- **Absolute paths from the site root** (`/assets/site.css`, `/en/...`). The site is served from the domain root.
- **Accuracy over features.** A tool that gives a wrong answer destroys trust. Every calculation must be covered
  by the tests in `tests/`.

## Structure

```
/                       bilingual home (lists every tool)
/zh-tw/                 Chinese home (Traditional Chinese, Taiwan)
/zh-tw/<category>/<tool-slug>/index.html + tool.js
/en/                    English home
/en/<category>/<tool-slug>/index.html + tool.js
/assets/site.css        shared design tokens and components
/assets/site.js         theme toggle + copy buttons
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
   `.tool` panels → affiliate slot comment → `.article` with an explanation, a reference table where useful,
   and a short FAQ (2–4 questions people actually search for).
5. SEO in `<head>`: unique `<title>` (tool name + what it does + "- Toolburrow"), meta description under
   ~155 characters, canonical URL, `WebApplication` JSON-LD.
6. Add the tool to the language home page AND the root `index.html`, and add its URL to `sitemap.xml`.
7. The tool must show a useful result on first load (pre-fill a sensible default) and update live as the user types.

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

Each tool page has a commented-out `<aside class="affiliate" data-slot="<slug>">` block below the tool panels.
Only the owner decides which products and links go there. When asked to fill one:
uncomment it, add 1–3 relevant product links with `rel="sponsored noopener" target="_blank"`, and keep the disclosure line.
Never invent affiliate URLs or tracking IDs.
