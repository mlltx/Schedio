---
name: ship-ui-change
description: Use this skill whenever making or about to make ANY change to the web/ Next.js app in this repo — new components, styling, copy, layout, interactions, bug fixes affecting what renders, anything visual or behavioral. Always follow it end-to-end (screenshot, commit, push, point to Vercel) even for small tweaks and even if the user didn't explicitly ask for screenshots, a commit, or a deployment link — that's the default expectation for every UI change here, not an opt-in extra.
---

# Ship a UI change

This repo's owner reviews changes visually, not by reading diffs. A code
change to `web/` isn't "done" until they've seen it work and it's pushed
somewhere they can check. This skill is the checklist for that loop.

## 1. Make the change

Edit the code as requested.

## 2. Confirm the dev server is up

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

If it's not `200`, start it in the background:

```bash
cd web && npm run dev
```

## 3. Screenshot the result with Playwright

`@playwright/test` is already a devDependency in `web/`, and Chromium is
pre-installed at `/opt/pw-browsers/chromium`. Node resolves the module from
`web/`'s `node_modules`, so write the capture script to `web/` (or `/tmp` and
copy it in) and run it with `cwd` inside `web/` — running from elsewhere
throws `Cannot find module '@playwright/test'`. Don't commit the capture
script itself; it's a throwaway tool, not part of the app.

```js
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.screenshot({ path: '/tmp/shot-1-initial.png', fullPage: true });

  // ...interact here if the change involves behavior, see below...

  await browser.close();
})();
```

**A single screenshot of the final page load only proves the page renders —
it doesn't show whether the change actually works.** If the change involves
any interaction (hover, click, toggle, form input, navigation, animation,
loading/error states, responsive breakpoints), script that interaction with
Playwright and capture each meaningful state: `page.hover(...)`,
`page.click(...)`, `page.fill(...)`, then screenshot again before moving on.
Name files so the sequence is obvious (`shot-1-initial.png`,
`shot-2-hover.png`, `shot-3-after-click.png`).

## 4. Send the screenshots to the user

```
SendUserFile({
  files: [...screenshot paths in order...],
  caption: "<short description of what changed>",
  status: "normal",
  display: "render",
})
```

## 5. Commit and push

Stage only the real code changes (never the throwaway capture script). Write
a descriptive commit message and push to the current feature branch, per
this repo's normal git workflow.

## 6. Point to the deployment

Once pushed, tell the user it's live and to check:

**https://vercel.com/mlltxs-projects/schedio/deployments**

That's the project's deployments list (not a single build's URL), so it
stays correct across every future push — always use this link, never a
one-off deployment URL that will go stale.
