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
const { ageStationData, parseStationData, stationLabel, stationTone } = require(path.join(dir, 'parkingStation.cjs'));
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

test('a delayed station response cannot renew an old clear reading or controller readiness', () => {
  const f = fixture(); f.generated_at = '2026-10-31T05:00:08Z'; f.online_seconds = 12;
  f.data[0].display_state = 'available';
  f.controllers = [{reader_id: 1, reader_code: 'USB-01', firmware_profile: 'integrated-v2', online: true, servo_enabled: true, servo_ready: true, oled_ready: true, ready: true, gate_state: 'clear', gate_position: 'closed', gate_distance_cm: 40, requires_review: false, last_seen_at: f.data[0].last_seen_at}];
  const parsed = parseStationData(f);
  assert.equal(stationLabel(ageStationData(parsed, 3000).data[0], true), 'Slot clear');
  const aged = ageStationData(parsed, 6000);
  assert.equal(stationLabel(aged.data[0], true), 'Sensor offline');
  assert.equal(aged.data[0].arrival_detected, false); assert.equal(aged.data[0].distance_cm, null);
  assert.equal(aged.controllers[0].ready, false); assert.equal(aged.controllers[0].servo_ready, false);
  assert.equal(aged.controllers[0].gate_state, 'unknown'); assert.equal(aged.servo_available, false);
  assert.equal(parsed.data[0].online, true); assert.equal(parsed.controllers[0].ready, true);
});

test('station freshness is per sensor and never trusts missing or future server timestamps', () => {
  const f = fixture(); f.generated_at = '2026-10-31T05:00:08Z'; f.online_seconds = 12;
  f.data.push({...f.data[0], station_id: 2, sensor_channel: 2, slot_id: 5, last_seen_at: '2026-10-31T05:00:07Z', display_state: 'available'});
  const aged = ageStationData(parseStationData(f), 6000);
  assert.equal(aged.data[0].online, false); assert.equal(aged.data[1].online, true);
  assert.equal(ageStationData(parseStationData(fixture()), 0).data[0].online, false);
  f.data[0].last_seen_at = '2026-10-31T05:01:00Z';
  assert.equal(ageStationData(parseStationData(f), 0).data[0].online, false);
  assert.equal(ageStationData(parseStationData(f), NaN).data[1].online, false);
  f.generated_at = 'invalid'; assert.throws(() => parseStationData(f), /incomplete/);
  f.generated_at = '2026-10-31T05:00:08Z'; f.online_seconds = 60;
  assert.throws(() => parseStationData(f), /incomplete/);
});

test('shared station labels follow fresh clear, occupied, then clear transitions', () => {
  for (const [state, expected] of [['available', 'Slot clear'], ['occupied', 'Slot occupied'], ['available', 'Slot clear']]) {
    const f = fixture(); f.generated_at = '2026-10-31T05:00:01Z'; f.online_seconds = 12; f.data[0].display_state = state;
    const station = ageStationData(parseStationData(f), 1000).data[0];
    assert.equal(stationLabel(station, true), expected);
  }
});
test('a busy or uncertain gate result cannot be dismissed or repeated before explicit review', () => {
  const s = new StaffBarrier(), t = s.begin(); s.dismiss(); assert.equal(s.snapshot().notice, true); assert.throws(() => s.begin(), /current/);
  s.failed(t, new Error('Disconnected')); s.finish(t); s.dismiss(); assert.equal(s.snapshot().reviewing, true); assert.equal(s.snapshot().notice, true); assert.throws(() => s.begin(), /Review/);
  s.reviewed(); s.dismiss(); assert.equal(s.snapshot().notice, false); const next = s.begin(); s.finish(next);
});
test('same-account navigation preserves a mandatory review and a changed account clears it', () => {
  const s = new StaffBarrier(); s.identify('one|staff|token'); const t = s.begin(); s.failed(t, {status: 503}); s.finish(t);
  s.identify('one|staff|token'); assert.equal(s.snapshot().reviewing, true);
  s.identify('two|admin|other-token'); assert.deepEqual({...s.snapshot(), message: ''}, {busy: false, pending: false, reviewing: false, notice: false, message: ''});
  s.failed(t, new Error('Old request')); assert.equal(s.snapshot().notice, false);
});
test('a queued staff parking action stays pending until its matching acknowledgement', async () => {
  let complete; const s = new StaffBarrier(() => new Promise(resolve => {complete = resolve;}));
  const t = s.begin(); const result = await s.approved(t, {kind: 'parking', direction: 'entry', status: 'granted', barrier_status: 'pending', barrier_command_id: 6});
  assert.equal(result.queued, true); s.dismiss(); assert.equal(s.snapshot().notice, true);
  assert.equal(s.snapshot().pending, true); assert.throws(() => s.begin(), /current/);
  complete({command_id: 6, status: 'acknowledged'}); await new Promise(resolve => setImmediate(resolve));
  assert.equal(s.snapshot().pending, false); assert.match(s.snapshot().message, /acknowledged/);
  const next = s.begin(); s.finish(next);
});
test('an old account hardware callback cannot populate the next account notice', async () => {
  let complete; const s = new StaffBarrier(() => new Promise(resolve => {complete = resolve;})); s.identify('one'); const t = s.begin();
  await s.approved(t, {kind: 'visitor', direction: 'exit', status: 'completed', barrier_status: 'pending', barrier_command_id: 7});
  s.identify('two'); complete({command_id: 7, status: 'acknowledged'}); await new Promise(resolve => setImmediate(resolve)); assert.equal(s.snapshot().notice, false);
});

test('four sensor channels and separate controller health stay explicit', () => {
  const f = fixture(); f.data[0].sensor_channel = '4';
  f.controllers = [{reader_id: 1, reader_code: 'USB-01', firmware_profile: 'integrated-v2', online: true, servo_enabled: 1, servo_ready: '1', oled_ready: '0', ready: true, gate_state: 'clear', gate_position: 'closed', gate_distance_cm: '40.5', requires_review: false, last_seen_at: '2026-11-06T00:00:00Z'}];
  const parsed = parseStationData(f); assert.equal(parsed.data[0].sensor_channel, 4); assert.equal(parsed.controllers[0].servo_ready, true); assert.equal(parsed.controllers[0].oled_ready, false);
  f.controllers[0].requires_review = true; assert.throws(() => parseStationData(f), /incomplete/);
  f.controllers[0].ready = false; f.data[0].sensor_channel = 5; assert.throws(() => parseStationData(f), /incomplete/);
});
test('an unconfirmed hardware command requires review before another staff action', async () => {
  const s = new StaffBarrier(async () => ({command_id: 9, status: 'unconfirmed'})); const ticket = s.begin();
  await s.approved(ticket, {kind: 'visitor', direction: 'entry', status: 'granted', barrier_status: 'pending', barrier_command_id: 9});
  await new Promise(resolve => setImmediate(resolve)); s.dismiss();
  assert.equal(s.snapshot().reviewing, true); assert.equal(s.snapshot().notice, true); assert.throws(() => s.begin(), /Review/);
});
test('an acknowledgement for a different command requires access-record review', async () => {
  const s = new StaffBarrier(async () => ({command_id: 11, status: 'acknowledged'}));
  await s.approved(s.begin(), {kind: 'parking', direction: 'exit', status: 'completed', barrier_status: 'pending', barrier_command_id: 10});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(s.snapshot().pending, false);
  assert.equal(s.snapshot().reviewing, true);
  assert.throws(() => s.begin(), /Review/);
});
test('missing gate metadata after a recorded action requires review', async () => {
  const s = new StaffBarrier();
  await s.approved(s.begin(), {kind: 'parking', direction: 'exit', status: 'completed'});
  assert.equal(s.snapshot().reviewing, true);
  assert.throws(() => s.begin(), /Review/);
});
