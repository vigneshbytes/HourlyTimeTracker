import { defineConfig } from 'vite';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

function listFiles(dir, base = dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? listFiles(p, base) : [relative(base, p).split('\\').join('/')];
  });
}

// Emits sw.js with a precache list of every built file, versioned by content hash,
// so each deploy refreshes the offline cache exactly when something changed.
function serviceWorker() {
  return {
    name: 'service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = [...Object.keys(bundle), ...listFiles('public')].filter((f) => f !== 'sw.js' && !f.split('/').pop().startsWith('.'));
      const hash = createHash('sha256').update(files.sort().join('|'));
      for (const f of Object.values(bundle)) hash.update(f.code || f.source || '');
      const version = `${pkg.version}-${hash.digest('hex').slice(0, 10)}`;
      const source = readFileSync('src/sw.js', 'utf8')
        .replace('__VERSION__', version)
        .replace("'__PRECACHE__'", JSON.stringify(['./', ...files.map((f) => `./${f}`)]));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { target: 'es2020', assetsInlineLimit: 0 },
  plugins: [serviceWorker()],
  test: { environment: 'jsdom', setupFiles: ['fake-indexeddb/auto'] },
});
