import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';

const workspaceRoot = resolve(import.meta.dirname, '..');
const packageJsonPath = resolve(workspaceRoot, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const version = String(packageJson.version || '0.0.0-dev');

await build({
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

console.log(`Built PopulationNotifier.js with version ${version}`);
