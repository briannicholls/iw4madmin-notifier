import { readFileSync, watch } from 'node:fs';
import { resolve } from 'node:path';
import { context } from 'esbuild';
import { buildThumbnails } from './build-thumbnails.mjs';

const workspaceRoot = resolve(import.meta.dirname, '..');
const packageJsonPath = resolve(workspaceRoot, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const version = String(packageJson.version || '0.0.0-dev');

await buildThumbnails(workspaceRoot);

const ctx = await context({
  entryPoints: [resolve(workspaceRoot, 'src/index.js')],
  bundle: true,
  format: 'iife',
  globalName: '_b',
  footer: {
    js: 'var init=_b.init;var plugin=_b.plugin;var commands=_b.commands;'
  },
  outfile: resolve(workspaceRoot, 'dist/PopulationNotifier.js'),
  define: {
    __PLUGIN_VERSION__: JSON.stringify(version)
  }
});

await ctx.watch();
const thumbnailSourceDir = resolve(workspaceRoot, 'src/t6_map_thumbnails');
try {
  watch(thumbnailSourceDir, { persistent: true }, async () => {
    try {
      const result = await buildThumbnails(workspaceRoot);
      console.log(`Rebuilt ${result.count} stretched thumbnails`);
    } catch (error) {
      console.error('Thumbnail rebuild failed:', error && error.message ? error.message : error);
    }
  });
} catch (error) {
  console.error('Thumbnail watch unavailable:', error && error.message ? error.message : error);
}

console.log(`Watching PopulationNotifier.js with version ${version}`);
