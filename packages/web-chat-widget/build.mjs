/**
 * Build script for the BookingOS Chat Widget.
 *
 * Uses esbuild to bundle src/index.ts into a single IIFE file.
 * Run: node build.mjs          (production, minified)
 * Run: node build.mjs --watch  (development, watch mode)
 *
 * esbuild is resolved from the monorepo's node_modules (transitive dep via tsx).
 * If esbuild is unavailable, install it: npm install -D esbuild
 */
import { mkdirSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const isWatch = process.argv.includes('--watch');

// Ensure dist directory exists
mkdirSync(resolve(__dirname, 'dist'), { recursive: true });

// Resolve esbuild from the monorepo root
const esbuild = require('../../node_modules/esbuild');

const buildOptions = {
  entryPoints: [resolve(__dirname, 'src/index.ts')],
  bundle: true,
  minify: !isWatch,
  format: 'iife',
  globalName: 'BookingOSChatModule',
  outfile: resolve(__dirname, 'dist/booking-os-chat.js'),
  target: ['es2020'],
  define: {
    'process.env.NODE_ENV': isWatch ? '"development"' : '"production"',
  },
  footer: {
    js: '/* BookingOS Chat Widget v1.0.0 */',
  },
};

async function build() {
  if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await esbuild.build(buildOptions);
    const outfile = resolve(__dirname, 'dist/booking-os-chat.js');
    const stats = statSync(outfile);
    console.log(`Built: dist/booking-os-chat.js (${(stats.size / 1024).toFixed(1)}KB)`);
  }
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
