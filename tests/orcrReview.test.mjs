import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

// The review logic used by the vehicle registration screen (src/lib/orcrReview.ts).
const source = readFileSync(new URL('../src/lib/orcrReview.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const file = join(mkdtempSync(join(tmpdir(), 'orcr-review-')), 'orcrReview.mjs');
writeFileSync(file, js);
const { combineReadings, reviewStatus, sourceOf, EMPTY_DETAILS } = await import(pathToFileURL(file).href);

const reading = (fields, flags = {}, notes = {}, status = Object.keys(flags).length ? 'partial' : 'ok') => ({ status, fields, flags, notes });
// Real 166 XAB documents: the OR has no make/series; the CR's make and series were read once.
const OR = reading({ plate_number: '166 XAB', color: 'BLACK', year_model: 2023, vehicle_type: 'Motorcycle' }, { make: 'missing', model: 'missing' });
const CR = reading({ plate_number: '166 XAB', make: 'SUZUKI', model: 'UB125NM', color: 'BLACK', vehicle_type: 'Motorcycle' },
  { make: 'low_confidence', model: 'low_confidence' },
  { make: 'Read from the Certificate of Registration (CR) with limited certainty. Check it against the document.', model: 'Read from the Certificate of Registration (CR) with limited certainty. Check it against the document.' });

/** What the screen does: combined readings, the owner's edits and confirmations, the shown values. */
function review(or, cr, { edits = {}, checked = {} } = {}) {
  const combined = combineReadings(or, cr);
  const details = Object.fromEntries(Object.keys(EMPTY_DETAILS).map(key => [key, edits[key] ?? (combined[key].value || '')]));
  const input = { or, cr, hasOr: !!or, hasCr: !!cr, combined, details, edits, checked };
  return { ...reviewStatus(input), details, source: key => sourceOf(key, input) };
}

test('matching plates and valid required details are a successful match', () => {
  const sure = reading({ plate_number: '166XAB', make: 'SUZUKI', model: 'UB125NM', color: 'BLACK', vehicle_type: 'Motorcycle' });
  const r = review(OR, sure);
  assert.equal(r.tone, 'success');
  assert.equal(r.title, 'OR/CR Match Successful');
  assert.deepEqual([r.conflicts, r.missing, r.toCheck, r.missingNotes], [[], [], [], []]);
  assert.ok(r.basis.includes('Plate number matches on the OR and CR.'));
  // Make and series were printed on the CR only: never claimed as matched on both.
  assert.ok(r.basis.includes('Make and model / series read from the CR.'));
  assert.equal(r.source('make'), 'from the CR');
});

test('low-certainty make and series need a check, and are successful once the owner confirms them', () => {
  const before = review(OR, CR);
  assert.equal(before.tone, 'check');
  assert.deepEqual(before.toCheck, ['make', 'model']);
  assert.match(before.message, /make and model \/ series were read from the CR with limited certainty/i);
  assert.equal(before.source('model'), 'from the CR, check this value');
  // Not a problem: nothing disagrees and nothing is missing.
  assert.deepEqual([before.conflicts, before.missing, before.missingNotes], [[], [], []]);

  const after = review(OR, CR, { checked: { make: 'SUZUKI', model: 'UB125NM' } });
  assert.equal(after.tone, 'success');
  assert.equal(after.title, 'OR/CR Match Successful');
  assert.equal(after.source('model'), 'from the CR, checked by you');
  assert.ok(after.basis.includes('Plate number matches on the OR and CR.'));
  assert.ok(after.basis.includes('Make and model / series read from the CR.'));

  // A confirmation belongs to the value: a new CR reading with another series needs a new check.
  const reread = reading({ ...CR.fields, model: 'UB125NN' }, CR.flags, CR.notes);
  assert.deepEqual(review(OR, reread, { checked: { make: 'SUZUKI', model: 'UB125NM' } }).toCheck, ['model']);
});

test('plates that genuinely differ are a mismatch naming both plates', () => {
  const r = review(OR, reading({ ...CR.fields, plate_number: '777 ABC' }));
  assert.equal(r.tone, 'problem');
  assert.equal(r.title, 'Plate mismatch');
  assert.match(r.message, /OR shows plate 166 XAB but the CR shows 777 ABC/);
  // Spacing alone is not a mismatch.
  assert.equal(review(reading({ ...OR.fields, plate_number: '166-XAB' }), reading({ ...CR.fields, plate_number: '166 XAB' })).plateConflict, false);
});

test('a missing required detail is named with the reason from the document', () => {
  const note = 'The SERIES area was located on the Certificate of Registration (CR) but could not be read clearly. Retake it flat, in focus and free of glare.';
  const { model, ...fields } = CR.fields;
  const r = review(OR, reading(fields, { model: 'missing' }, { model: note }));
  assert.equal(r.tone, 'problem');
  assert.equal(r.title, 'Missing detail');
  assert.deepEqual(r.missing, ['model']);
  assert.match(r.message, /^Model \/ series could not be read on the OR or CR/);
  assert.deepEqual(r.missingNotes, [note]);
  // Entering it resolves the problem and is labelled as the owner's value.
  const fixed = review(OR, reading(fields, { model: 'missing' }, { model: note }), { edits: { model: 'UB125NM' } });
  assert.equal(fixed.tone, 'success');
  assert.equal(fixed.source('model'), 'entered by you');
  assert.ok(fixed.basis.includes('Model / series entered by you.'));
});

test('correcting an uncertain or conflicting value recalculates the status', () => {
  assert.equal(review(OR, CR, { edits: { make: 'SUZUKI', model: 'UB125NM' } }).tone, 'success');
  // OR and CR show different makes: a mismatch until the owner enters the printed value.
  const or = reading({ ...OR.fields, make: 'HONDA' });
  const conflict = review(or, reading({ ...CR.fields }, {}));
  assert.equal(conflict.title, 'Mismatch');
  assert.match(conflict.message, /make \(OR: HONDA · CR: SUZUKI\)/);
  assert.equal(review(or, reading({ ...CR.fields }, {}), { edits: { make: 'SUZUKI' } }).tone, 'success');
});

test('a document that must be retaken is a problem, while a partly read one is not', () => {
  assert.equal(review(reading({}, {}, {}, 'retake'), CR).title, 'Retake needed');
  assert.notEqual(review(OR, CR).tone, 'problem'); // both photos are "partial": read, with fields to combine
  assert.equal(review({ status: 'reading', fields: {}, flags: {} }, CR).tone, 'reading');
});
