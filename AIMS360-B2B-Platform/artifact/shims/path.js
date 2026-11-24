export const join = (...p) => p.join('/').replace(/\/+/g, '/');
export const dirname = (p) => p.replace(/\/[^/]*$/, '') || '/';
export const resolve = join;
export default { join, dirname, resolve };
