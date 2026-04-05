import { build } from 'esbuild';
import { writeFileSync } from 'fs';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: 'dist/index.js',
  // Don't bundle optional native modules
  external: [],
});

// Write a minimal declaration file so the package exports still work
writeFileSync('dist/index.d.ts', '// Bundled CLI — no public API\nexport {};\n');
