import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pass-list-page-'));
fs.writeFileSync(path.join(dir, 'listPage.cjs'), ts.transpileModule(fs.readFileSync(new URL('../src/lib/listPage.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
const { listMeta, listPath } = require(path.join(dir, 'listPage.cjs'));
process.on('exit', () => fs.rmSync(dir, { recursive: true, force: true }));
test('searches remain values rather than introducing extra API filters', () => {
  const q = listPath('/api/vehicles', 2, { search: 'ABC & status=approved', type: 'Motorcycle' });
  const p = new URL(q, 'https://pass.example').searchParams;
  assert.equal(p.get('search'), 'ABC & status=approved'); assert.equal(p.get('page'), '2'); assert.equal(p.get('type'), 'Motorcycle'); assert.equal(p.has('status'), false);
});
test('first page stays compatible with older servers and pending pages are independent', () => {
  assert.equal(listPath('/api/rfid/inventory'), '/api/rfid/inventory');
  assert.equal(listPath('/api/rfid/inventory', 2, { pending_page: 3 }), '/api/rfid/inventory?page=2&pending_page=3');
  assert.equal(listMeta(undefined, 3).total, 3);
});
test('empty and out-of-range pages keep the authoritative total and last page', () => {
  const m = { current_page: 5, per_page: 20, last_page: 3, total: 45, from: null, to: null };
  assert.deepEqual(listMeta(m), m); assert.equal(listMeta({ ...m, current_page: 1, last_page: 1, total: 0 }).total, 0);
});
test('malformed pagination is reported rather than hiding subsequent records', () => {
  for (const m of [null, {}, { current_page: 1, per_page: 101, last_page: 1, total: 1 }, { current_page: 0, per_page: 20, last_page: 1, total: 0 }, { current_page: 1, per_page: 20, last_page: 1, total: -1 }]) assert.throws(() => listMeta(m), /incomplete/);
});
