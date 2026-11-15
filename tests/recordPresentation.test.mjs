import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url), directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pass-record-presentation-'));
for (const name of ['datetime', 'recordPresentation']) {
  const source = fs.readFileSync(new URL('../src/lib/' + name + '.ts', import.meta.url), 'utf8');
  fs.writeFileSync(path.join(directory, name + '.js'), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText);
}
const { auditPresentation, changes, snapshot, valueText, revisionSummary, csvCell } = require(path.join(directory, 'recordPresentation.js'));
const { campusDateKey } = require(path.join(directory, 'datetime.js'));
process.on('exit', () => fs.rmSync(directory, { recursive: true, force: true }));
test('new action names fall back to an ordinary recorded event', () => {
  const p = auditPresentation({ action: 'future_normal_action', auditable_type: 'User', auditable_id: 7 });
  assert.equal(p.outcome, 'recorded'); assert.equal(p.variant, 'info'); assert.equal(p.action, 'Future normal action');
});
test('field changes show business differences while ignoring reordered object keys', () => {
  const rows = changes({ contact_number: '09170000001', options: { a: 1, b: 2 }, updated_at: '2026-10-23' }, { contact_number: '09170000002', options: { b: 2, a: 1 }, updated_at: '2026-10-24' });
  assert.equal(rows.length, 1); assert.equal(rows[0].label, 'Contact number');
  assert.equal(changes({ updated_at: 'old' }, { updated_at: 'new' }, true).length, 1);
});
test('sensitive nested fields and document paths stay out of detail tables', () => {
  const safe = snapshot({ email: 'demo@example.test', password: 'secret', vehicle_photo_path: '/private/image', nested: { reader_key: 'key', status: 'active' } });
  assert.deepEqual(safe, { email: 'demo@example.test', nested: { status: 'active' } });
  assert.equal(JSON.stringify(changes(null, safe)).includes('/private'), false);
});
test('snapshots and empty values have readable descriptions', () => {
  assert.equal(revisionSummary('baseline', null, { user_code: 'DEMO' }), 'Initial saved version');
  assert.equal(valueText('account_status', 'pending_review'), 'Pending review');
  assert.equal(valueText('contact_number', null), 'Not set'); assert.equal(valueText('contact_number', undefined), 'Not recorded');
  assert.equal(valueText('user_code', 'ABC-123'), 'ABC-123');
});
test('exported cells preserve commas, quotes and line breaks without spreadsheet formulas', () => {
  assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell('Normal, text\nline'), '"Normal, text\nline"');
});
test('retained timestamps preserve Philippine time in fields and nested values', () => {
  const previousZone = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';
  try {
    const midnight = 'Oct 24, 2026, 12:30 AM PHT';
    assert.equal(valueText('entry_datetime', '2026-10-23T16:30:00Z'), midnight);
    assert.equal(valueText('valid_from', '2026-10-23 16:30:00'), midnight);
    assert.equal(valueText('valid_until', '2026-10-23T16:30:00+00:00'), midnight);
    assert.equal(valueText('details', { checked_at: '2026-10-23T16:30:00Z' }), JSON.stringify({ checked_at: midnight }));
    assert.equal(valueText('valid_until', '2026-10-24'), '2026-10-24');
    assert.equal(valueText('user_code', '2026-10-23T16:30:00Z'), '2026-10-23T16:30:00Z');
    assert.equal(campusDateKey('2026-10-23T16:30:00Z'), '2026-10-24');
  } finally {
    if (previousZone === undefined) delete process.env.TZ; else process.env.TZ = previousZone;
  }
});
