import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
const here = import.meta.dirname;
const nm = path.join(here, '..', 'node_modules');
const shim = (f) => path.join(here, 'shims', f);
export default defineConfig({
  root: here,
  mode: 'artifact',
  plugins: [react()],
  define: { 'process.env': '{}', 'process.argv': '[]' },
  resolve: {
    alias: [
      { find: /^express$/, replacement: shim('express.js') },
      { find: /^node:fs$/, replacement: shim('fs.js') },
      { find: /^node:path$/, replacement: shim('path.js') },
      { find: /^node:url$/, replacement: shim('url.js') },
      { find: /^node:crypto$/, replacement: shim('crypto.js') },
      { find: /^exceljs$/, replacement: path.join(nm, 'exceljs/dist/exceljs.min.js') },
      { find: /^pdfkit$/, replacement: path.join(nm, 'pdfkit/js/pdfkit.standalone.js') },
      { find: /^buffer$/, replacement: path.join(nm, 'buffer/index.js') },
      { find: /^@fontsource-variable\/montserrat$/, replacement: shim('font.css') }
    ]
  },
  build: {
    outDir: path.join(here, '..', 'dist-artifact'),
    emptyOutDir: true,
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: { output: { inlineDynamicImports: true } }
  }
});
