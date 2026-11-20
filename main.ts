// Vireo City — the entry program (Node 22, standard library only): the game is
// this directory's game/ folder, plain static files a desktop browser loads
// offline (game/index.html and its ES modules, no library and no network request),
// and the program hands it in. It copies game/ and screenshots/ from beside
// this file to /output and writes /output/dossier.json, the summary the judge
// reads, with the vendored make.fun library.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function listFiles(dir, prefix) {
  const found = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    const st = statSync(path);
    if (st.isDirectory()) found.push(...listFiles(path, rel));
    else if (st.isFile()) found.push({ rel, bytes: st.size });
  }
  return found;
}

function main() {
  mkdirSync(out, { recursive: true });
  cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
  mkdirSync(join(out, 'screenshots'), { recursive: true });
  if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

  // The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
  // scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
  // files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
  // screenshots/ and dossier.json).
  const dossier = buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(out, 'dossier.json'), dossier);

  // A short, machine-readable summary on stdout: the grader reads the exit code,
  // a human reads this.
  const shots = listFiles(join(out, 'screenshots'), '').sort((a, b) => (a.rel < b.rel ? -1 : 1));
  const gameFiles = listFiles(join(out, 'game'), '');
  console.log(`vireo-city: wrote ${out}`);
  console.log(`  game files: ${gameFiles.length} (${gameFiles.reduce((n, f) => n + f.bytes, 0)} bytes)`);
  console.log(`  screenshots: ${shots.map((s) => `${s.rel} (${s.bytes} bytes)`).join(', ')}`);
  console.log(`  dossier.json: ${dossier.length} bytes`);
}

// Any failure (a missing game/, an over-cap screenshot, a dossier that will not
// build) must fail loudly: the grader reads the exit code.
try {
  main();
} catch (error) {
  console.error(`vireo-city: FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
