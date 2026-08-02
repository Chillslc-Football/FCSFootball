import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const redirectsPath = path.join(root, 'dist', '_redirects');

if (!existsSync(redirectsPath)) {
  console.error('SPA fallback missing: dist/_redirects was not copied from public/_redirects');
  process.exit(1);
}

const contents = readFileSync(redirectsPath, 'utf8').trim();
if (!/^\/\*+\s+\/index\.html\s+200$/m.test(contents)) {
  console.error(
    `SPA fallback invalid in dist/_redirects.\nExpected: /* /index.html 200\nGot:\n${contents}`,
  );
  process.exit(1);
}

console.log('ok  - dist/_redirects SPA fallback present');
