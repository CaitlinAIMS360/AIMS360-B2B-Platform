# AIMS360 B2B Platform

A wholesale ordering portal for AIMS360 brands and their retail buyers:
catalog with customer pricing, Immediate / Prebook / Bulk orders, linesheets,
OTS reports, exports, guest browsing with access requests, and a brand admin
area with orders, buyers, reports and settings.

**Status: demo mode.** It runs on sample data. Nothing is read from or sent to AIMS360 yet.

## Two ways to run it

| | What it is | Where data lives |
| --- | --- | --- |
| **Web app** (`npm start`) | The real thing: one server everyone shares. | On the server. Everyone sees the same orders. |
| **Demo page** (`docs/index.html`) | The whole portal packed into one page, for click-through demos. Can be served by GitHub Pages. | In each visitor's own browser. Nothing is shared. |

## Run the web app on your computer

Windows: double-click `Start Portal.bat`. Otherwise:

```
npm install
npm run build
npm start
```

Then open http://localhost:3000. Demo logins are on the sign-in screen.

## Put it online

See [DEPLOY.md](DEPLOY.md).

## Rebuild the demo page

```
npx vite build -c artifact/vite.config.js --mode artifact
node artifact/assemble.mjs
```

## Tests

```
npm test
```
