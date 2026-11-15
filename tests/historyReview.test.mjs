import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, cpSync, readdirSync, symlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { analyzeText, decodeText, inspectHistory, inspectProject, formatReport } = require('../tools/Inspect-PassHistory.cjs');
const sentinel = 'SYNTHETIC_SECRET_NEVER_PRINT_23bfc49';

function fixture(t, name = 'PASS-BE-LARAVEL') {
  const base = mkdtempSync(path.join(tmpdir(), 'pass-history-triage-')), dir = path.join(base, name);
  mkdirSync(dir); const hooks = path.join(base, 'empty-hooks'); mkdirSync(hooks);
  const global = path.join(base, 'empty-global.gitconfig'); writeFileSync(global, '');
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('GIT_')));
  Object.assign(env, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: global, GIT_TERMINAL_PROMPT: '0' });
  const git = args => execFileSync('git', ['--no-pager', '-c', 'core.hooksPath=' + hooks, '-c', 'commit.gpgSign=false', '-c', 'core.fsmonitor=false', '-C', dir, ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10000 });
  const put = (name, content) => { const file = path.join(dir, name); mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, content); };
  const commit = names => { git(['add', '-f', '--', ...names]); git(['commit', '-m', 'Synthetic history fixture']); };
  git(['init']); git(['config', 'user.name', 'Synthetic Review']); git(['config', 'user.email', 'review@example.invalid']);
  put('storage/app/private/.gitignore', '*\n!.gitignore\n'); commit(['storage/app/private/.gitignore']);
  t.after(() => rmSync(base, { recursive: true, force: true }));
  return { base, dir, git, put, commit };
}
function snapshot(dir) {
  const result = new Map();
  const walk = (at, prefix = '') => { for (const entry of readdirSync(at, { withFileTypes: true })) { const rel = prefix + entry.name, file = path.join(at, entry.name); if (entry.isDirectory()) walk(file, rel + '/'); else if (entry.isFile()) result.set(rel, readFileSync(file).toString('hex')); } };
  walk(dir); return result;
}

test('history findings retain only fixed key/table categories and never credential or row values', () => {
  const result = analyzeText('APP_KEY="' + sentinel + '"\nDB_PASSWORD=\nMAIL_PASSWORD=\'\'\nCUSTOM_PRIVATE_NAME=' + sentinel + '\nINSERT INTO `users` (`email`) VALUES (\'' + sentinel + '\');\n-----BEGIN PRIVATE KEY-----\n' + sentinel);
  assert.deepEqual(result.credentialKeys, ['APP_KEY']); assert.deepEqual(result.tables, { users: 1 }); assert.equal(result.privateKeyMarker, true);
  assert.equal(JSON.stringify(result).includes(sentinel), false); assert.equal(JSON.stringify(result).includes('CUSTOM_PRIVATE_NAME'), false);
});
test('SQL comments, quoted strings and schema-only definitions do not invent data statements', () => {
  const result = analyzeText("-- INSERT INTO users VALUES ('ignore');\n# INSERT INTO users VALUES ('ignore');\n/* INSERT INTO users VALUES ('ignore'); */\nCREATE TABLE users (value varchar(40) DEFAULT 'INSERT INTO users VALUES (1)');\nSELECT \"INSERT INTO users VALUES (2)\";");
  assert.deepEqual(result.tables, {}); assert.equal(result.unknownTables, 0); assert.deepEqual(result.gaps, []);
});
test('MySQL schema-qualified, multi-line and REPLACE headers are counted as statements rather than rows', () => {
  const result = analyzeText("INSERT IGNORE INTO `projectsystem`.`users`\n(`email`)\nVALUES ('one'),('two');\nREPLACE INTO rfid_readers VALUES ('three');\nINSERT INTO `" + sentinel + "` VALUES ('four');");
  assert.deepEqual(result.tables, { users: 1, rfid_readers: 1 }); assert.equal(result.unknownTables, 1); assert.equal(JSON.stringify(result).includes(sentinel), false);
});
test('SQL escaped quotes remain values and unsupported executable data comments stay reviewable', () => {
  const escaped = analyzeText("INSERT INTO users VALUES ('can\\'t INSERT INTO vehicles VALUES (1)', 'it''s quoted');");
  assert.deepEqual(escaped.tables, { users: 1 }); assert.deepEqual(escaped.gaps, []);
  assert.ok(analyzeText("/*!50001 INSERT INTO users VALUES ('x'); */").gaps.length);
  assert.ok(analyzeText("INSERT INTO users VALUES ('unfinished").gaps.length);
});
test('UTF-8 BOM and Windows UTF-16 dumps decode without accepting binary or invalid text', () => {
  const source = 'INSERT INTO users VALUES (1);';
  assert.equal(decodeText(Buffer.from('\ufeff' + source)), source);
  const le = Buffer.from('\ufeff' + source, 'utf16le'); assert.equal(decodeText(le), source);
  const be = Buffer.from(le); be.swap16(); assert.equal(decodeText(be), source);
  assert.equal(decodeText(Buffer.from([0xc3, 0x28])), null); assert.equal(decodeText(Buffer.from('opaque\x00binary')), null);
});
test('deleted root and nested historical versions are found while templates and unrelated source are excluded', t => {
  const f = fixture(t);
  f.put('before.sql', "INSERT INTO users VALUES ('" + sentinel + "');");
  f.put('backup/NESTED.SQL', "INSERT INTO rfid_readers VALUES ('" + sentinel + "');");
  f.put('.env', 'APP_KEY=' + sentinel); f.put('nested/.env.production', 'MAIL_PASSWORD=' + sentinel);
  f.put('.env.example', 'DB_PASSWORD=' + sentinel); f.put('nested/.env.production.template', 'GITHUB_TOKEN=' + sentinel);
  f.put('src/unrelated.js', 'OPENAI_API_KEY=' + sentinel);
  f.commit(['before.sql', 'backup/NESTED.SQL', '.env', 'nested/.env.production', '.env.example', 'nested/.env.production.template', 'src/unrelated.js']);
  f.git(['rm', '--cached', '--', 'before.sql', 'backup/NESTED.SQL', '.env', 'nested/.env.production']); f.git(['commit', '-m', 'Untrack synthetic candidates']);
  const before = snapshot(f.dir), result = inspectHistory(f.dir);
  assert.equal(result.gitAvailable, true, JSON.stringify(result)); assert.deepEqual(result.gaps, []); assert.equal(result.selectedBlobs, 4); assert.equal(result.analyzedTextBlobs, 4);
  assert.deepEqual(result.sqlStatementCandidates, { users: 1, rfid_readers: 1 }); assert.deepEqual(result.credentialCandidates, { APP_KEY: 1, MAIL_PASSWORD: 1 }); assert.equal(result.status, 'REVIEW');
  assert.equal(JSON.stringify(result).includes(sentinel), false); assert.deepEqual(snapshot(f.dir), before);
});
test('a changed historical SQL version and another local branch remain in scope', t => {
  const f = fixture(t); f.put('backup/data.sql', 'INSERT INTO users VALUES (1);'); f.commit(['backup/data.sql']);
  f.git(['branch', 'other-fixture']); f.put('backup/data.sql', 'INSERT INTO vehicles VALUES (2);'); f.commit(['backup/data.sql']);
  f.git(['checkout', 'other-fixture']); f.put('.env.staging', 'DB_PASSWORD=' + sentinel); f.commit(['.env.staging']); f.git(['checkout', '-']);
  const result = inspectHistory(f.dir); assert.equal(result.selectedBlobs, 3); assert.deepEqual(result.sqlStatementCandidates, { vehicles: 1, users: 1 }); assert.deepEqual(result.credentialCandidates, { DB_PASSWORD: 1 });
});
test('merge-parent data and a version obscured by a replacement ref remain detectable', t => {
  const f = fixture(t); const base = f.git(['rev-parse', 'HEAD']).trim(); f.git(['branch', 'side-fixture']);
  f.put('backup/data.sql', 'INSERT INTO users VALUES (1);'); f.commit(['backup/data.sql']); const dataCommit = f.git(['rev-parse', 'HEAD']).trim();
  f.put('backup/data.sql', 'CREATE TABLE users (id INT);'); f.commit(['backup/data.sql']);
  f.git(['checkout', 'side-fixture']); f.put('.env.side', 'DB_PASSWORD=' + sentinel); f.commit(['.env.side']); f.git(['checkout', '-']);
  f.git(['merge', '--no-ff', '-m', 'Merge synthetic fixtures', 'side-fixture']); f.git(['replace', dataCommit, base]);
  const before = snapshot(f.dir), result = inspectHistory(f.dir);
  assert.deepEqual(result.sqlStatementCandidates, { users: 1 }); assert.deepEqual(result.credentialCandidates, { DB_PASSWORD: 1 }); assert.deepEqual(result.gaps, []); assert.deepEqual(snapshot(f.dir), before);
});
test('plain text with compressed or encrypted SQL suffixes is skipped rather than falsely cleared', t => {
  const f = fixture(t); for (const name of ['a.sql.enc', 'nested/b.sql.gz', 'nested/c.sql.zip']) f.put(name, 'encoded_' + name);
  f.commit(['a.sql.enc', 'nested/b.sql.gz', 'nested/c.sql.zip']); const result = inspectHistory(f.dir);
  assert.equal(result.selectedBlobs, 3); assert.equal(result.skippedBlobs, 3); assert.equal(result.analyzedTextBlobs, 0); assert.equal(result.status, 'REVIEW'); assert.match(result.gaps.join(' '), /compressed\/encrypted/);
});
test('size, count, byte and elapsed-time caps remain explicit coverage gaps', t => {
  const f = fixture(t); f.put('a.sql', 'INSERT INTO users VALUES (1);'); f.put('b.sql', 'INSERT INTO vehicles VALUES (2);'); f.commit(['a.sql', 'b.sql']);
  for (const limits of [{ objects: 1 }, { blobs: 0 }, { blobBytes: 1 }, { totalBytes: 1 }, { milliseconds: -1 }]) {
    const result = inspectHistory(f.dir, { limits }); assert.equal(result.status, 'REVIEW'); assert.ok(result.gaps.length, JSON.stringify(limits)); assert.equal(JSON.stringify(result).includes(sentinel), false);
  }
});
test('schema-only selected history retains an explicit limited status and does not clear a release', t => {
  const f = fixture(t); f.put('schema.sql', 'CREATE TABLE users (user_id INT);'); f.commit(['schema.sql']);
  const result = inspectHistory(f.dir); assert.equal(result.status, 'CHECKED_SCOPE'); assert.equal(result.selectedBlobs, 1); assert.deepEqual(result.sqlStatementCandidates, {});
  const project = inspectProject(f.base); assert.equal(project.releaseCleared, false); assert.match(formatReport(project), /not proof.*free of secrets/);
});
test('the ignore policy reads its indexed blob, ignores unstaged values and rejects a linked index entry', t => {
  const f = fixture(t); const file = path.join(f.dir, 'storage/app/private/.gitignore');
  f.put('storage/app/private/.gitignore', 'PRIVATE_UNSTAGED_SENTINEL');
  assert.equal(inspectHistory(f.dir).protection.status, 'CHECKED_SCOPE');
  f.put('storage/app/private/.gitignore', '*\n!.gitignore\n!license.jpg\n#' + sentinel); f.git(['add', '-f', '--', 'storage/app/private/.gitignore']);
  const result = inspectHistory(f.dir); assert.equal(result.protection.status, 'REVIEW'); assert.equal(JSON.stringify(result).includes(sentinel), false);
  f.git(['update-index', '--cacheinfo', '120000,' + f.git(['rev-parse', ':storage/app/private/.gitignore']).trim() + ',storage/app/private/.gitignore']);
  assert.equal(inspectHistory(f.dir).protection.status, 'REVIEW'); assert.equal(readFileSync(file, 'utf8').includes(sentinel), true);
});
test('the protection file is reviewed when missing, and selected non-regular historical files are not followed', t => {
  const f = fixture(t); f.git(['rm', '--cached', '--', 'storage/app/private/.gitignore']);
  assert.equal(inspectHistory(f.dir).protection.status, 'REVIEW');
  f.put('target.txt', sentinel); f.commit(['target.txt']); const id = f.git(['rev-parse', 'HEAD:target.txt']).trim();
  f.git(['update-index', '--add', '--cacheinfo', '120000,' + id + ',linked.sql']); f.git(['commit', '-m', 'Synthetic linked candidate']);
  const result = inspectHistory(f.dir); assert.match(result.gaps.join(' '), /non-regular/); assert.equal(result.analyzedTextBlobs, 0); assert.equal(JSON.stringify(result).includes(sentinel), false);
});
test('missing independent metadata and an unrelated parent are never substituted', t => {
  const f = fixture(t); const child = path.join(f.dir, 'not-a-repo'); mkdirSync(child);
  const result = inspectHistory(child); assert.equal(result.gitAvailable, false); assert.equal(result.status, 'REVIEW'); assert.ok(result.gaps.length);
});
test('shallow history remains a coverage gap even if selected text looks harmless', t => {
  const f = fixture(t); f.put('schema.sql', 'CREATE TABLE users (id INT);'); f.commit(['schema.sql']);
  writeFileSync(path.join(f.dir, '.git/shallow'), f.git(['rev-parse', 'HEAD']).trim() + '\n');
  const result = inspectHistory(f.dir); assert.equal(result.status, 'REVIEW'); assert.match(result.gaps.join(' '), /shallow/);
});
test('missing promised objects are reported without lazy fetching or changing files', t => {
  const f = fixture(t); f.put('missing.sql', 'INSERT INTO users VALUES (1);'); f.commit(['missing.sql']);
  const oid = f.git(['rev-parse', 'HEAD:missing.sql']).trim(); rmSync(path.join(f.dir, '.git/objects', oid.slice(0, 2), oid.slice(2)));
  const before = snapshot(f.dir), result = inspectHistory(f.dir); assert.equal(result.status, 'REVIEW'); assert.ok(result.gaps.length); assert.deepEqual(snapshot(f.dir), before);
});
test('inherited Git overrides cannot redirect reads or inject private error output', t => {
  const f = fixture(t); f.put('.env', 'APP_KEY=' + sentinel); f.commit(['.env']);
  const child = path.join(f.base, 'not-repository'); mkdirSync(child);
  const probe = 'console.log(JSON.stringify(require(process.argv[1]).inspectHistory(process.argv[2])))';
  const output = execFileSync(process.execPath, ['-e', probe, require.resolve('../tools/Inspect-PassHistory.cjs'), f.dir], { encoding: 'utf8', timeout: 20000,
    env: { ...process.env, GIT_DIR: path.join(child, sentinel), GIT_WORK_TREE: child, GIT_INDEX_FILE: path.join(child, 'index'), GIT_TRACE: '1', GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'alias.rev-list', GIT_CONFIG_VALUE_0: '!echo ' + sentinel } });
  assert.equal(JSON.parse(output).gitAvailable, true); assert.deepEqual(JSON.parse(output).credentialCandidates, { APP_KEY: 1 }); assert.equal(output.includes(sentinel), false);
});
test('directory aliases retain selected historical findings', t => {
  const f = fixture(t); f.put('archive.sql', 'INSERT INTO users VALUES (1);'); f.commit(['archive.sql']); const alias = path.join(f.base, 'SHORTP~1');
  try { symlinkSync(f.dir, alias, process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (['EPERM', 'ENOTSUP', 'EACCES'].includes(error.code)) { t.skip('Directory aliases unavailable'); return; } throw error; }
  const result = inspectHistory(alias); assert.equal(result.gitAvailable, true); assert.deepEqual(result.sqlStatementCandidates, { users: 1 });
});
test('the real CLI prints only categories/counts and leaves all synthetic project files unchanged', t => {
  const f = fixture(t); for (const name of ['PASS-FE-REACT', 'PASS-FE-NATIVE']) mkdirSync(path.join(f.base, name));
  const toolDir = path.join(f.base, 'PASS-FE-REACT/tools'); mkdirSync(toolDir);
  for (const name of ['Inspect-PassHistory.cjs', 'Inspect-PassRelease.cjs']) cpSync(require.resolve('../tools/' + name), path.join(toolDir, name));
  f.put('backup/' + sentinel + '.sql', "INSERT INTO users VALUES ('" + sentinel + "');"); f.put('.env', 'DB_PASSWORD=' + sentinel); f.commit(['backup/' + sentinel + '.sql', '.env']);
  const before = snapshot(f.base), output = execFileSync(process.execPath, [path.join(toolDir, 'Inspect-PassHistory.cjs')], { encoding: 'utf8', timeout: 20000 });
  assert.match(output, /credential candidate DB_PASSWORD/); assert.match(output, /SQL data-statement candidate users/); assert.equal(output.includes(sentinel), false); assert.match(output, /RELEASE NOT CLEARED/); assert.deepEqual(snapshot(f.base), before);
});
