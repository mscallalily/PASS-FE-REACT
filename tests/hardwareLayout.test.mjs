import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
const require = createRequire(import.meta.url), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pass-hardware-layout-'));
for (const name of ['hardwareLayout', 'parkingStation']) fs.writeFileSync(path.join(dir, name + '.cjs'), ts.transpileModule(fs.readFileSync(new URL('../src/lib/' + name + '.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
const { hasHardwareAccess, showSlotSummary, showGateNotice } = require(path.join(dir, 'hardwareLayout.cjs'));
const { parseStationData, stationLabel, stationTone } = require(path.join(dir, 'parkingStation.cjs'));
fs.writeFileSync(path.join(dir, 'staffBarrier.mjs'), fs.readFileSync(new URL('../src/lib/staffBarrier.js', import.meta.url), 'utf8').replace("import { apiRequest } from './apiClient';", "const apiRequest = () => { throw new Error('Unit test made an unexpected request'); };") );
const { StaffBarrier } = await import(pathToFileURL(path.join(dir, 'staffBarrier.mjs')));
process.on('exit', () => fs.rmSync(dir, { recursive: true, force: true }));
const fixture = () => ({
  can_configure: true, servo_available: false, slots: [{slot_id: 4, slot_code: 'M-04', zone_name: 'A', area_name: 'Motorcycles', parking_area_id: 1}],
  readers: [{reader_id: 1, reader_code: 'USB-01', gate_name: 'Main', parking_area_id: null}],
  data: [{station_id: 1, reader_id: 1, slot_id: 4, slot_code: 'M-04', zone_name: 'A', area_name: 'Motorcycles', reader_code: 'USB-01', online: true, oled_ready: 1, arrival_detected: true, display_state: 'occupied', distance_cm: '12.50', last_seen_at: '2026-10-31T13:00:00+08:00', assignment: {transaction_id: 8, plate_number: 'TEST-08'}}],
});
test('hardware setup stays in its workspace and compact feedback stays on staff operational routes', () => {
  assert.equal(hasHardwareAccess('admin'), true); assert.equal(hasHardwareAccess('parking_staff'), true);
  for (const role of ['student', 'faculty', 'employee', 'guest', null, undefined]) { assert.equal(hasHardwareAccess(role), false); assert.equal(showSlotSummary(role, '/app/dashboard'), false); assert.equal(showGateNotice(role, '/app/users'), false); }
  for (const route of ['/app/dashboard', '/app/rfid/monitor', '/app/qr-verify', '/app/parking/occupancy', '/app/vehicle-releases']) assert.equal(showSlotSummary('parking_staff', route), true);
  for (const route of ['/app/users', '/app/records/accounts', '/app/vehicles/authorization', '/app/hardware', '/app/rfid/inventory']) assert.equal(showSlotSummary('parking_staff', route), false);
  assert.equal(showSlotSummary('admin', '/app/dashboard'), false); assert.equal(showGateNotice('parking_staff', '/app/records/history'), true); assert.equal(showGateNotice('parking_staff', '/app/hardware'), false);
});
test('numeric database flags and distances are parsed explicitly rather than treating zero as truthy', () => {
  const f = fixture(); f.can_configure = '0'; f.data[0].oled_ready = '0'; f.data[0].arrival_detected = 0; f.data[0].station_id = '1';
  const d = parseStationData(f); assert.equal(d.can_configure, false); assert.equal(d.data[0].oled_ready, false); assert.equal(d.data[0].arrival_detected, false); assert.equal(d.data[0].distance_cm, 12.5); assert.equal(d.data[0].station_id, 1);
});
test('malformed sensor data is reported instead of fabricating healthy readings', () => {
  for (const change of [f => {delete f.slots;}, f => {f.data[0].online = 'false';}, f => {f.data[0].last_seen_at = null;}, f => {f.data[0].distance_cm = 'NaN';}, f => {f.data[0].assignment = {};}, f => {f.readers[0].reader_id = -1;}, f => {f.data[0].display_state = 'healthy';}]) {
    const f = fixture(); change(f); assert.throws(() => parseStationData(f), /incomplete/);
  }
});
test('offline and unverified readings take priority over stored occupancy colors', () => {
  const s = parseStationData(fixture()).data[0]; assert.equal(stationLabel(s, true), 'Slot occupied');
  assert.equal(stationLabel(s, false), 'Status unavailable'); assert.equal(stationTone(s, false), 'text-slate-500');
  s.online = false; assert.equal(stationLabel(s, true), 'Sensor offline'); assert.equal(stationTone(s, true), 'text-slate-500');
});
test('a busy or uncertain gate result cannot be dismissed or repeated before explicit review', () => {
  const s = new StaffBarrier(), t = s.begin(); s.dismiss(); assert.equal(s.snapshot().notice, true); assert.throws(() => s.begin(), /current/);
  s.failed(t, new Error('Disconnected')); s.finish(t); s.dismiss(); assert.equal(s.snapshot().reviewing, true); assert.equal(s.snapshot().notice, true); assert.throws(() => s.begin(), /Review/);
  s.reviewed(); s.dismiss(); assert.equal(s.snapshot().notice, false); const next = s.begin(); s.finish(next);
});
test('same-account navigation preserves a mandatory review and a changed account clears it', () => {
  const s = new StaffBarrier(); s.identify('one|staff|token'); const t = s.begin(); s.failed(t, {status: 503}); s.finish(t);
  s.identify('one|staff|token'); assert.equal(s.snapshot().reviewing, true);
  s.identify('two|admin|other-token'); assert.deepEqual({...s.snapshot(), message: ''}, {busy: false, reviewing: false, notice: false, message: ''});
  s.failed(t, new Error('Old request')); assert.equal(s.snapshot().notice, false);
});
test('a late hardware acknowledgement raises a fresh notice after an informational notice was dismissed', async () => {
  let complete; const s = new StaffBarrier(() => new Promise(resolve => {complete = resolve;}));
  const t = s.begin(); const result = await s.approved(t, {kind: 'visitor', direction: 'entry', status: 'granted', barrier_status: 'pending', barrier_command_id: 6});
  assert.equal(result.queued, true); s.dismiss(); assert.equal(s.snapshot().notice, false);
  complete({status: 'acknowledged'}); await new Promise(resolve => setImmediate(resolve)); assert.equal(s.snapshot().notice, true); assert.match(s.snapshot().message, /acknowledged/);
});
test('an old account hardware callback cannot populate the next account notice', async () => {
  let complete; const s = new StaffBarrier(() => new Promise(resolve => {complete = resolve;})); s.identify('one'); const t = s.begin();
  await s.approved(t, {kind: 'visitor', direction: 'exit', status: 'completed', barrier_status: 'pending', barrier_command_id: 7});
  s.identify('two'); complete({status: 'acknowledged'}); await new Promise(resolve => setImmediate(resolve)); assert.equal(s.snapshot().notice, false);
});
