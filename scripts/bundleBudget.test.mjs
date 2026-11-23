import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

test('el worker PDF .mjs está sujeto al mismo presupuesto que otros chunks', () => {
  const root = mkdtempSync(join(tmpdir(), 'civilcardex-budget-'));
  const dist = join(root, 'dist');
  const assets = join(dist, 'assets');
  mkdirSync(assets, { recursive: true });
  const index = join(dist, 'index.html');
  const entry = join(assets, 'index-fixture.js');
  const worker = join(assets, 'pdf.worker-fixture.mjs');
  const script = fileURLToPath(new URL('./bundleBudget.mjs', import.meta.url));
  try {
    writeFileSync(index, '<script src="/assets/index-fixture.js"></script>');
    writeFileSync(entry, '');
    writeFileSync(worker, Buffer.alloc(1400 * 1024));
    assert.equal(spawnSync(process.execPath, [script], { cwd: root }).status, 0);
    writeFileSync(worker, Buffer.alloc(1401 * 1024));
    const result = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /pdf\.worker-fixture\.mjs/);
  } finally {
    unlinkSync(worker);
    unlinkSync(entry);
    unlinkSync(index);
    rmdirSync(assets);
    rmdirSync(dist);
    rmdirSync(root);
  }
});
