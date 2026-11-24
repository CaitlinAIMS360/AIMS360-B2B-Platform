// The server keeps its data in a file. In the page, that "file" is the browser's own storage.
const mem = new Map();
const key = (f) => 'aims360-b2b:' + f;
export function readFileSync(file) {
  let v = null;
  try { v = localStorage.getItem(key(file)); } catch { /* storage blocked */ }
  v ??= mem.get(file);
  if (v == null) throw new Error('ENOENT');
  return v;
}
export function writeFileSync(file, data) {
  mem.set(file, data);
  try { localStorage.setItem(key(file), data); } catch { /* keep in memory */ }
}
export function renameSync(a, b) {
  writeFileSync(b, readFileSync(a));
  mem.delete(a);
  try { localStorage.removeItem(key(a)); } catch { /* ignore */ }
}
export const mkdirSync = () => {};
export const existsSync = () => false;
export default { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync };
