import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pass-registration-departments-'));
fs.writeFileSync(path.join(dir, 'departments.cjs'), ts.transpileModule(fs.readFileSync(new URL('../src/lib/registrationDepartments.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
const { isCollegeDepartment } = require(path.join(dir, 'departments.cjs'));
process.on('exit', () => fs.rmSync(dir, { recursive: true, force: true }));
test('office aliases with extra spacing or mixed case stay out of college options', () => {
  for (const name of ['Security Office', 'security  office', ' HR Department ', 'IT\tDepartment', 'Registrar\u00A0Office']) assert.equal(isCollegeDepartment({ department_code: 'OFF', department_name: name }), false, name);
});
test('school-level and incomplete options cannot be selected as college departments', () => {
  for (const code of ['SHS', ' shs ', 'JHS', 'BED', '']) assert.equal(isCollegeDepartment({ department_code: code, department_name: 'Example unit' }), false);
  assert.equal(isCollegeDepartment({}), false); assert.equal(isCollegeDepartment({ department_code: 'COE', department_name: '  ' }), false);
});
test('legitimate college names are preserved without guessing from a substring', () => {
  for (const name of ['Engineering', 'Information Technology', 'IT Department Studies', 'Security Office Research College']) assert.equal(isCollegeDepartment({ department_code: 'COE', department_name: name }), true, name);
});
