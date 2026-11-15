#!/usr/bin/env node
'use strict';
// Reads Vite output only. No application configuration, network or user data.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
function main() {
  const root = path.resolve(__dirname, '..');
  const dist = path.join(root, 'dist');
  const manifest = JSON.parse(fs.readFileSync(path.join(dist, '.vite/manifest.json'), 'utf8'));
  const heavy = 'src/components/ParkingLot3D.tsx';
  const keys = Object.keys(manifest);
  let checks = 0;
  const check = (label, run) => { try { run(); checks++; } catch (error) { throw new Error(label + ': ' + error.message); } };
  const closure = key => {
    const seen = new Set();
    function visit(item) {
      if (seen.has(item)) return;
      assert.ok(manifest[item], 'Missing manifest dependency ' + item);
      seen.add(item);
      for (const child of manifest[item].imports || []) visit(child);
    }
    visit(key); return seen;
  };
  const renderKeys = keys.filter(key => key === heavy || manifest[key].name === 'parking-three');
  check('3D stays an optional dynamic entry', () => assert.equal(manifest[heavy]?.isDynamicEntry, true));
  check('Three.js split output is present', () => assert.ok(renderKeys.length >= 3));
  const roots = keys.filter(key => manifest[key].isEntry || key === 'src/pages/app/ParkingOperations.tsx' || manifest[key].name === 'ParkingAvailabilityMap');
  check('map entry points are represented', () => assert.ok(roots.some(key => key.includes('ParkingOperations')) && roots.some(key => manifest[key].name === 'ParkingAvailabilityMap')));
  for (const key of roots) check('optional renderer is absent from the static imports of ' + key, () => {
    const reachable = closure(key);
    assert.ok(renderKeys.every(item => !reachable.has(item)), '3D would download before the user selects it');
  });
  for (const key of keys) check('output budget and source maps ' + key, () => {
    const file = manifest[key].file;
    assert.ok(typeof file === 'string' && !path.isAbsolute(file) && !file.split('/').includes('..'));
    const output = path.join(dist, file);
    assert.ok(fs.statSync(output).isFile());
    if (file.endsWith('.js')) assert.ok(fs.statSync(output).size <= 500000, file + ' exceeds the 500 kB JavaScript budget');
    assert.equal(fs.existsSync(output + '.map'), false);
  });
  console.log('PASS MAP BUILD CHECK | ' + checks + ' checks | 3D remains optional | all JavaScript chunks <= 500 kB');
  console.log('This verifies build structure, not phone performance, physical capacity or launch readiness.');
}
if (require.main === module) {
  try { main(); } catch (error) { console.error('MAP BUILD CHECK FAILED: ' + error.message); process.exitCode = 1; }
}
module.exports = { main };
