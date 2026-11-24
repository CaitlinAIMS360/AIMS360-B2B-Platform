// Packs the built portal into one page that follows the Claude artifact rules.
import fs from 'node:fs';
import path from 'node:path';
const dist = path.join(import.meta.dirname, '..', 'dist-artifact', 'assets');
const files = fs.readdirSync(dist);
let css = fs.readFileSync(path.join(dist, files.find((f) => f.endsWith('.css'))), 'utf8');
const js = fs.readFileSync(path.join(dist, files.find((f) => f.endsWith('.js'))), 'utf8');
// Dark colours also apply when the viewer's device is dark and no theme was picked.
const dark = /:root\[data-theme=["']?dark["']?\]\{([^}]*)\}/.exec(css);
if (!dark) throw new Error('dark theme block not found');
css += `@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${dark[1]}}}`;
// Side gutters that also clear a phone's system bars.
css += `.topbar-inner,.page,.login-form{padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}`
  + `.topbar{top:env(safe-area-inset-top,0px)}`
  + `body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:30;background:var(--bg)}`;
const html = `<title>AIMS360 B2B Portal</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>${css}</style>
<div id="root"></div>
<script type="module">${js.replace(/<\/script/gi, '<\\/script').replace(/\uFFFD/g, '\\uFFFD')}</script>
`;
const out = path.join(import.meta.dirname, '..', 'dist-artifact', 'aims360-b2b-portal.html');
fs.writeFileSync(out, html);
console.log(out, (html.length / 1e6).toFixed(2) + ' MB');
