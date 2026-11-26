const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const pcDir = __dirname;
const rootDir = path.resolve(pcDir, '..');
const appOutDir = path.join(pcDir, 'app');
const skipWebBuild = process.argv.includes('--skip-web-build');

function loadEsbuild() {
  try {
    return require('esbuild');
  } catch {
    return require(path.join(rootDir, 'node_modules', 'esbuild'));
  }
}

async function main() {
  const rootDistDir = path.join(rootDir, 'dist');
  const rootDistIndex = path.join(rootDistDir, 'index.html');

  if (!skipWebBuild || !fs.existsSync(rootDistIndex)) {
    console.log('[gestion antiquite PC] Building web frontend...');
    execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });
  }

  if (!fs.existsSync(rootDistIndex)) {
    throw new Error(`Missing built frontend at ${rootDistDir}`);
  }

  fs.rmSync(appOutDir, { recursive: true, force: true });
  fs.mkdirSync(appOutDir, { recursive: true });

  console.log('[gestion antiquite PC] Copying built frontend assets...');
  fs.cpSync(rootDistDir, path.join(appOutDir, 'dist'), { recursive: true });

  const rootImagesDir = path.join(rootDir, 'src', 'assets', 'images');
  if (fs.existsSync(rootImagesDir)) {
    fs.cpSync(rootImagesDir, path.join(appOutDir, 'src', 'assets', 'images'), {
      recursive: true,
    });
  }

  console.log('[gestion antiquite PC] Bundling Express + SQLite backend...');
  const esbuild = loadEsbuild();
  await esbuild.build({
    entryPoints: [path.join(rootDir, 'server.ts')],
    outfile: path.join(appOutDir, 'server.mjs'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    sourcemap: false,
    external: [
      'better-sqlite3',
      'express',
      'xlsx',
      'dotenv',
      'vite',
    ],
    banner: {
      js: [
        "import { createRequire as __createRequire } from 'node:module';",
        'const require = __createRequire(import.meta.url);',
      ].join('\n'),
    },
  });

  console.log('[gestion antiquite PC] Desktop assets prepared at', appOutDir);
}

main().catch((err) => {
  console.error('[gestion antiquite PC] Failed to prepare assets:', err);
  process.exit(1);
});
