import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, symlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { classifyTrackedPath, inspectRewrite, inspectRepo } = require('../tools/Inspect-PassRelease.cjs');

function fixtureGit(dir) {
  const hooks = path.join(dir, 'empty-hooks'); mkdirSync(hooks);
  const global = path.join(dir, 'empty-global.gitconfig'); writeFileSync(global, '');
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.toUpperCase().startsWith('GIT_')));
  env.GIT_CONFIG_NOSYSTEM = '1'; env.GIT_CONFIG_GLOBAL = global; env.GIT_TERMINAL_PROMPT = '0';
  return args => execFileSync('git', ['--no-pager', '-c', 'core.hooksPath=' + hooks, '-c', 'commit.gpgSign=false', '-c', 'core.fsmonitor=false', '-C', dir, ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10000 });
}
function aliasDirectory(target, alias, t) {
  try { symlinkSync(target, alias, process.platform === 'win32' ? 'junction' : 'dir'); return true; }
  catch (error) {
    if (['EPERM', 'ENOTSUP', 'EACCES'].includes(error.code)) { t.skip('Directory aliases are not permitted on this filesystem'); return false; }
    throw error;
  }
}

test('release filename review finds nested private/generated candidates but preserves configuration templates', () => {
  for (const name of ['.env', '.env.production', 'tools/hardware/node_modules/a/index.js', 'backup/before.sql', 'storage/app/private/license.jpg', 'backup\\before.sql.gz']) assert.ok(classifyTrackedPath(name), name);
  for (const name of ['.env.example', '.env.production.template', 'config/app.php', 'src/pages/app/RFIDManagement.tsx', 'README.md']) assert.equal(classifyTrackedPath(name), null, name);
});
test('only the exact private-storage protection filename is exempted from document candidates', () => {
  assert.equal(classifyTrackedPath('storage/app/private/.gitignore'), null);
  assert.equal(classifyTrackedPath('storage\\app\\private\\.gitignore'), null);
  for (const name of ['storage/app/private/license.jpg', 'storage/app/private/.env', 'storage/app/private/.gitignore.bak', 'storage/app/private/subfolder/.gitignore', 'other/storage/app/private/.gitignore']) assert.ok(classifyTrackedPath(name), name);
});
test('a fixed HTTPS rewrite requires environment isolation review rather than claiming an exposed database', () => {
  const result = inspectRewrite({ rewrites: [{ source: '/api/:path*', destination: 'https://synthetic-api.example.invalid/api/:path*' }] });
  assert.equal(result.status, 'REVIEW'); assert.match(result.message, /previews and production/);
  assert.equal(result.message.includes('exposed'), false);
});
test('rewrite diagnostics never echo credentials or query strings', () => {
  const secret = 'SYNTHETIC_SECRET_DO_NOT_PRINT';
  const result = inspectRewrite({ rewrites: [{ source: '/api/:path*', destination: 'https://user:' + secret + '@example.invalid/api/:path*?key=' + secret }] });
  assert.equal(result.status, 'REVIEW'); assert.equal(JSON.stringify(result).includes(secret), false);
});
test('missing Git metadata remains an explicit coverage gap', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'pass-review-no-git-'));
  try { const result = inspectRepo(dir); assert.equal(result.gitAvailable, false); assert.equal(result.history, null); }
  finally { rmSync(dir, { recursive: true, force: true }); }
});
test('untracking synthetic private files preserves detectable history without reading their contents', t => {
  try { execFileSync('git', ['--version'], { stdio: 'ignore' }); } catch { t.skip('Git unavailable'); return; }
  const dir = mkdtempSync(path.join(tmpdir(), 'pass-review-history-'));
  const git = fixtureGit(dir);
  try {
    git(['init']); git(['config', 'user.name', 'Synthetic Review']); git(['config', 'user.email', 'review@example.invalid']);
    const secret = 'SYNTHETIC_PRIVATE_CONTENT_SENTINEL';
    writeFileSync(path.join(dir, '.env'), secret); writeFileSync(path.join(dir, 'before.sql'), secret);
    git(['add', '-f', '--', '.env', 'before.sql']); git(['commit', '-m', 'Synthetic fixture']);
    const tracked = inspectRepo(dir); assert.equal(tracked.gitAvailable, true, tracked.message); assert.equal(tracked.tracked.length, 2); assert.equal(JSON.stringify(tracked).includes(secret), false);
    git(['rm', '--cached', '.env', 'before.sql']); git(['commit', '-m', 'Untrack fixture']);
    const before = git(['status', '--porcelain']);
    const inspected = inspectRepo(dir);
    assert.equal(inspected.tracked.length, 0); assert.equal(inspected.history.length, 2);
    assert.equal(JSON.stringify(inspected).includes(secret), false);
    assert.equal(git(['status', '--porcelain']), before);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('an unrelated parent repository is not inspected as the requested PASS repository', t => {
  try { execFileSync('git', ['--version'], { stdio: 'ignore' }); } catch { t.skip('Git unavailable'); return; }
  const dir = mkdtempSync(path.join(tmpdir(), 'pass-review-parent-'));
  try {
    fixtureGit(dir)(['init']);
    const child = path.join(dir, 'PASS-FE-REACT'); mkdirSync(child);
    assert.equal(inspectRepo(child).gitAvailable, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('a repository directory alias retains tracked and historical private-file detection', t => {
  try { execFileSync('git', ['--version'], { stdio: 'ignore' }); } catch { t.skip('Git unavailable'); return; }
  const base = mkdtempSync(path.join(tmpdir(), 'pass-review-alias-'));
  try {
    const real = path.join(base, 'Actual repository with spaces'); mkdirSync(real);
    const alias = path.join(base, 'SHORTP~1');
    if (!aliasDirectory(real, alias, t)) return;
    const git = fixtureGit(real); git(['init']); git(['config', 'user.name', 'Synthetic Review']); git(['config', 'user.email', 'review@example.invalid']);
    const secret = 'SYNTHETIC_ALIAS_CONTENT_SENTINEL';
    writeFileSync(path.join(real, '.env'), secret); writeFileSync(path.join(real, 'before.sql'), secret);
    git(['add', '-f', '--', '.env', 'before.sql']); git(['commit', '-m', 'Alias fixture']);
    const tracked = inspectRepo(alias); assert.equal(tracked.gitAvailable, true, tracked.message); assert.equal(tracked.tracked.length, 2); assert.equal(JSON.stringify(tracked).includes(secret), false);
    git(['rm', '--cached', '.env', 'before.sql']); git(['commit', '-m', 'Untrack alias fixture']);
    const history = inspectRepo(alias); assert.equal(history.gitAvailable, true, history.message); assert.equal(history.tracked.length, 0); assert.deepEqual(history.history.sort(), ['.env', 'before.sql']);
    assert.equal(JSON.stringify(history).includes(secret), false);
  } finally { rmSync(base, { recursive: true, force: true }); }
});
test('an aliased child still cannot borrow its parent repository', t => {
  try { execFileSync('git', ['--version'], { stdio: 'ignore' }); } catch { t.skip('Git unavailable'); return; }
  const base = mkdtempSync(path.join(tmpdir(), 'pass-review-alias-child-'));
  try {
    const parent = path.join(base, 'parent'); mkdirSync(parent); fixtureGit(parent)(['init']);
    const child = path.join(parent, 'PASS-FE-REACT'); mkdirSync(child);
    const alias = path.join(base, 'child-alias'); if (!aliasDirectory(child, alias, t)) return;
    const inspected = inspectRepo(alias); assert.equal(inspected.gitAvailable, false); assert.equal(inspected.history, null);
  } finally { rmSync(base, { recursive: true, force: true }); }
});
test('inherited Git directory and index overrides cannot redirect the inspection', t => {
  try { execFileSync('git', ['--version'], { stdio: 'ignore' }); } catch { t.skip('Git unavailable'); return; }
  const base = mkdtempSync(path.join(tmpdir(), 'pass-review-git-env-'));
  try {
    const intended = path.join(base, 'intended'); mkdirSync(intended); const own = fixtureGit(intended); own(['init']);
    writeFileSync(path.join(intended, 'own.sql'), 'SYNTHETIC_OWN_CONTENT'); own(['add', '-f', '--', 'own.sql']);
    const other = path.join(base, 'other'); mkdirSync(other); const foreign = fixtureGit(other); foreign(['init']);
    writeFileSync(path.join(other, '.env.production'), 'SYNTHETIC_FOREIGN_CONTENT'); foreign(['add', '-f', '--', '.env.production']);
    const probe = 'const {inspectRepo}=require(process.argv[1]);console.log(JSON.stringify(inspectRepo(process.argv[2])))';
    const output = execFileSync(process.execPath, ['-e', probe, require.resolve('../tools/Inspect-PassRelease.cjs'), intended], { encoding: 'utf8', timeout: 10000,
      env: { ...process.env, GIT_DIR: path.join(other, '.git'), GIT_WORK_TREE: other, GIT_INDEX_FILE: path.join(other, '.git/index') } });
    const result = JSON.parse(output); assert.equal(result.gitAvailable, true, result.message); assert.deepEqual(result.tracked.map(item => item.file), ['own.sql']);
    assert.equal(output.includes('SYNTHETIC_OWN_CONTENT'), false); assert.equal(output.includes('SYNTHETIC_FOREIGN_CONTENT'), false);
  } finally { rmSync(base, { recursive: true, force: true }); }
});
