import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// Inlines <!-- svg:name --> placeholders in index.html with src/svg/name.svg
const inlineSvg = () => ({
  name: 'inline-svg',
  transformIndexHtml(html) {
    return html.replace(/<!--\s*svg:([\w-]+)\s*-->/g, (_, name) =>
      fs.readFileSync(path.resolve(__dirname, `src/svg/${name}.svg`), 'utf8')
    );
  },
});

export default defineConfig({
  base: './',
  plugins: [inlineSvg()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'], motion: ['gsap', 'lenis'] },
      },
    },
  },
});
