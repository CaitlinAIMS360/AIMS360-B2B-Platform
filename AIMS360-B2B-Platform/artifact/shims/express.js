// A very small stand-in for Express so the same route files run inside the page.
function compile(path, end) {
  if (path === '*' || path === '/' && !end) return { re: /^/, keys: [] };
  const keys = [];
  const src = path.replace(/\/$/, '').replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)'));
  return { re: new RegExp('^' + src + (end ? '/?$' : '(?=/|$)')), keys };
}
export function Router() {
  const stack = [];
  const router = (req, res, out) => {
    let i = 0;
    const next = (err) => {
      const layer = stack[i++];
      if (!layer) return out(err);
      if (layer.method && layer.method !== req.method) return next(err);
      const m = layer.match.re.exec(req.path);
      if (!m) return next(err);
      const isErr = layer.fn.length === 4;
      if (err ? !isErr : isErr) return next(err);
      const saved = { path: req.path, params: req.params };
      if (layer.method) {
        req.params = { ...req.params };
        layer.match.keys.forEach((k, j) => (req.params[k] = decodeURIComponent(m[j + 1])));
      } else {
        req.path = req.path.slice(m[0].length) || '/';
      }
      const done = (e) => { req.path = saved.path; req.params = saved.params; next(e); };
      try {
        const r = err ? layer.fn(err, req, res, done) : layer.fn(req, res, done);
        if (r && typeof r.catch === 'function') r.catch(done);
      } catch (e) {
        done(e);
      }
    };
    next();
  };
  router.use = (path, ...fns) => {
    if (typeof path === 'function') { fns.unshift(path); path = '/'; }
    for (const fn of fns) stack.push({ match: compile(path, false), fn });
    return router;
  };
  for (const method of ['get', 'post', 'put', 'patch', 'delete'])
    router[method] = (path, ...fns) => {
      for (const fn of fns) stack.push({ method: method.toUpperCase(), match: compile(path, true), fn });
      return router;
    };
  return router;
}
export default { Router };
