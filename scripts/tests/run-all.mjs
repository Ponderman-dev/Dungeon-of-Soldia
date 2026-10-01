// Runs every *.test.mjs file and fails if any line says FAIL. Usage: npm test
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const dir = new URL('./', import.meta.url);
let failed = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith('.test.mjs'))) {
  const out = execFileSync('node', [new URL(file, dir).pathname], { encoding: 'utf8' });
  const bad = out.split('\n').filter((l) => l.startsWith('FAIL'));
  console.log(`${bad.length ? 'FAIL' : 'ok  '} ${file} (${out.split('\n').filter((l) => l.startsWith('PASS')).length} passed)`);
  for (const l of bad) console.log('     ' + l);
  failed += bad.length;
}
process.exit(failed ? 1 : 0);
