import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pass-sensor-age-')), file=path.join(dir,'age.cjs');
fs.writeFileSync(file,ts.transpileModule(fs.readFileSync(new URL('../src/lib/sensorAvailability.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText);
const {ageSensorAvailability,loadSensorSnapshot}=createRequire(import.meta.url)(file);
process.on('exit',()=>fs.rmSync(dir,{recursive:true,force:true}));
const slot=(status,held=false)=>({area_code:'CAR',status,recorded_occupied:held,sensor:{online:true,state:status,distance_cm:status==='occupied'?10:40,last_seen_at:'2026-11-06T00:00:00Z'}});
const figures={area_code:'CAR',capacity:5,occupied:2,recorded_occupied:1,unverified_occupied:1,available:2,maintenance:1,sensor_unavailable:0};
const fixture=()=>({generated_at:'2026-11-06T00:00:01Z',slots:[slot('available'),slot('occupied'),slot('occupied',true),slot('maintenance'),{area_code:'CAR',status:'available',sensor:null}],areas:[{...figures}],overall:{...figures}});
test('cached clear and unverified occupied slots become unavailable without another API response',()=>{
 const f=fixture();assert.equal(ageSensorAvailability(f,1000).overall.available,2);
 const aged=ageSensorAvailability(f,12000);assert.equal(aged.slots[0].status,'unknown');assert.equal(aged.slots[1].status,'unknown');
 assert.equal(aged.overall.available,1);assert.equal(aged.overall.occupied,1);assert.equal(aged.overall.unverified_occupied,0);assert.equal(aged.overall.sensor_unavailable,2);
 assert.equal(aged.overall.available+aged.overall.occupied+aged.overall.maintenance+aged.overall.sensor_unavailable,5);
 assert.equal(aged.areas[0].sensor_unavailable,2);assert.equal(f.slots[0].status,'available');
});
test('sensor loss preserves recorded holds and maintenance and does not affect unmapped slots',()=>{
 const aged=ageSensorAvailability(fixture(),30000);assert.equal(aged.slots[2].status,'occupied');assert.equal(aged.slots[2].sensor.online,false);
 assert.equal(aged.slots[3].status,'maintenance');assert.equal(aged.slots[4].status,'available');
 const twice=ageSensorAvailability(aged,40000);assert.deepEqual(twice.overall,aged.overall);
});
test('malformed or future sensor times never become a fresh clear reading',()=>{
 const f=fixture();f.slots[0].sensor.last_seen_at='invalid';f.slots[1].sensor.last_seen_at='2027-01-01T00:00:00Z';
 const aged=ageSensorAvailability(f,0);assert.equal(aged.slots[0].status,'unknown');assert.equal(aged.slots[1].status,'unknown');
});
test('an eight-second-old sensor reading is stale on receipt after a six-second HTTP delay',async()=>{
 let now=1000,complete;const pending=loadSensorSnapshot(()=>new Promise(resolve=>{complete=resolve;}),()=>now);
 const f=fixture();f.generated_at='2026-11-06T00:00:08Z';now=7000;complete(f);
 const result=await pending,aged=ageSensorAvailability(result.value,now-result.requestStartedAt);
 assert.equal(aged.slots[0].status,'unknown');assert.equal(aged.slots[1].status,'unknown');
 assert.equal(aged.slots[2].status,'occupied');assert.equal(aged.overall.sensor_unavailable,2);
 assert.equal(aged.overall.available+aged.overall.occupied+aged.overall.maintenance+aged.overall.sensor_unavailable,5);
});
test('overlapping polls retain their own request clocks when responses complete out of order',async()=>{
 let now=0,completeSlow,completeFast;
 const slow=loadSensorSnapshot(()=>new Promise(resolve=>{completeSlow=resolve;}),()=>now);
 now=5500;const fast=loadSensorSnapshot(()=>new Promise(resolve=>{completeFast=resolve;}),()=>now);
 const f=fixture();f.generated_at='2026-11-06T00:00:08Z';now=6000;
 completeFast(f);const fresh=await fast;completeSlow(f);const stale=await slow;
 assert.equal(ageSensorAvailability(fresh.value,now-fresh.requestStartedAt).slots[0].status,'available');
 assert.equal(ageSensorAvailability(stale.value,now-stale.requestStartedAt).slots[0].status,'unknown');
});
