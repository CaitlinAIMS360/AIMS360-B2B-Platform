// Linesheet layout: an ordered list of styles with optional dividers between
// them (for drops or deliveries), plus an optional hero image.
import { getProvider } from './aims360/index.js';
import { id } from './store.js';

const IMAGE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/;

// Uploaded pictures arrive as data URLs already resized in the browser.
export function cleanImage(value, existing, maxBytes, label) {
  if (value === undefined) return existing || '';
  if (!value) return '';
  if (typeof value !== 'string' || !IMAGE.test(value)) throw Object.assign(new Error(`${label} must be a PNG or JPEG image.`), { status: 400 });
  if (value.length > maxBytes * 1.37) throw Object.assign(new Error(`${label} is too large. Try a smaller image.`), { status: 400 });
  return value;
}

// Older linesheets only have a list of styles; treat that as a layout with no dividers.
export function layoutOf(l) {
  return Array.isArray(l.layout) && l.layout.length ? l.layout : (l.styles || []).map((style) => ({ type: 'style', style }));
}

export function cleanLayout(body, existing = {}) {
  const p = getProvider();
  const raw = Array.isArray(body.layout) ? body.layout : body.styles ? body.styles.map((style) => ({ type: 'style', style })) : layoutOf(existing);
  const seen = new Set();
  const layout = [];
  for (const item of raw) {
    if (item?.type === 'divider') {
      const title = String(item.title || '').trim().slice(0, 60);
      if (!title) throw Object.assign(new Error('Give every divider a title, or remove it.'), { status: 400 });
      layout.push({ type: 'divider', id: item.id || id('div'), title, note: String(item.note || '').trim().slice(0, 120) });
    } else if (item?.style && p.getStyle(item.style) && !seen.has(item.style)) {
      seen.add(item.style);
      layout.push({ type: 'style', style: item.style });
    }
  }
  return { layout, styles: [...seen] };
}

// Groups the layout into sections. Styles before the first divider form an untitled section.
export function sectionsOf(l, toItem) {
  const sections = [];
  let current = null;
  for (const item of layoutOf(l)) {
    if (item.type === 'divider') {
      current = { id: item.id, title: item.title, note: item.note || '', items: [] };
      sections.push(current);
    } else {
      const view = toItem(item.style);
      if (!view) continue;
      if (!current) { current = { id: 'top', title: '', note: '', items: [] }; sections.push(current); }
      current.items.push(view);
    }
  }
  return sections.filter((s) => s.title || s.items.length);
}
