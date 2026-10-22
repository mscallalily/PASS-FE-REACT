import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/datetime.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const moduleUrl = 'data:text/javascript;base64,' + Buffer.from(js).toString('base64');
const { parseApiDateTime, formatCampusDateTime, formatCampusDate, campusDateKey, campusDateTimeReplacer } = await import(moduleUrl);

test('equivalent API instants have the same Philippine display', () => {
  const expected = formatCampusDateTime('2026-10-22T00:22:00Z');
  assert.match(expected, /8:22\s*AM\s*PHT/);
  for (const value of ['2026-10-22 00:22:00', '2026-10-22T00:22:00', '2026-10-22T08:22:00+08:00', '2026-10-22T08:22:00+0800']) {
    assert.equal(formatCampusDateTime(value), expected);
  }
  assert.equal(formatCampusDateTime('2026-10-22T00:22:00Z', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }), '8:22 AM PHT');
});

test('database microseconds are parsed without double shifting an explicit offset', () => {
  assert.equal(parseApiDateTime('2026-10-22 00:22:00.123456').toISOString(), '2026-10-22T00:22:00.123Z');
  assert.equal(parseApiDateTime('2026-10-22T08:22:00.123456+08:00').toISOString(), '2026-10-22T00:22:00.123Z');
});

test('campus dates change at Philippine midnight rather than UTC midnight', () => {
  assert.equal(campusDateKey('2026-10-21T15:59:59Z'), '2026-10-21');
  assert.equal(campusDateKey('2026-10-21T16:00:00Z'), '2026-10-22');
  assert.equal(campusDateKey('2026-12-31T16:00:00Z'), '2027-01-01');
});

test('calendar-only expiry and validity dates keep their printed day', () => {
  assert.equal(campusDateKey('2026-10-22'), '2026-10-22');
  assert.equal(formatCampusDate('2026-10-22'), 'Oct 22, 2026');
  assert(!formatCampusDate('2026-10-22').includes('AM'));
  assert.equal(campusDateKey('2024-02-29'), '2024-02-29');
});

test('missing and invalid dates render an empty marker rather than an invented date', () => {
  for (const value of [null, undefined, 0, {}, '', 'bad date', '2026-02-30', '2026-13-01', '2026-10-22T25:00:00', '2026-10-22T00:61:00']) {
    assert.equal(parseApiDateTime(value), null);
    assert.equal(formatCampusDateTime(value), '—');
    if (value !== undefined) assert.equal(campusDateKey(value), '');
  }
});

test('retained record display converts timestamps without modifying original values', () => {
  const record = Object.freeze({ created_at: '2026-10-22 00:22:00', expiry_date: '2026-10-22', note: '2026-10-22 00:22:00', requested_valid_from: '2026-10-22T00:22:00Z' });
  const display = JSON.parse(JSON.stringify(record, campusDateTimeReplacer));
  assert.match(display.created_at, /8:22\s*AM\s*PHT/);
  assert.equal(display.requested_valid_from, display.created_at);
  assert.equal(display.expiry_date, record.expiry_date);
  assert.equal(display.note, record.note);
  assert.equal(record.created_at, '2026-10-22 00:22:00');
});

for (const timezone of ['UTC', 'Asia/Manila', 'America/Los_Angeles', 'Asia/Tokyo', 'Pacific/Kiritimati']) {
  test(`device timezone ${timezone} cannot change admin/user/guest display or calendar dates`, () => {
    const script = `const d=await import(${JSON.stringify(moduleUrl)}); console.log(JSON.stringify([d.formatCampusDateTime('2026-10-22 00:22:00'), d.formatCampusDateTime('2026-10-22T08:22:00+08:00'), d.formatCampusDate('2026-10-22'), d.campusDateKey('2026-10-21T16:00:00Z')]));`;
    const child = spawnSync(process.execPath, ['--input-type=module', '--eval', script], { encoding: 'utf8', env: { ...process.env, TZ: timezone }, timeout: 10000 });
    assert.equal(child.status, 0, child.stderr);
    const [admin, owner, expiry, date] = JSON.parse(child.stdout);
    assert.equal(admin, owner); assert.match(admin, /8:22\s*AM\s*PHT/);
    assert.equal(expiry, 'Oct 22, 2026'); assert.equal(date, '2026-10-22');
  });
}
