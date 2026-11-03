#!/usr/bin/env node
'use strict';
// Local source/filename inspection only. Never reads .env contents, SQL rows,
// private documents or historical Git blobs, and never connects to a remote.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const REPOS = ['PASS-BE-LARAVEL', 'PASS-FE-REACT', 'PASS-FE-NATIVE'];

function classifyTrackedPath(value) {
  const file = value.replace(/\\/g, '/').toLowerCase();
  if (/(^|\/)\.env(?:\.[^/]*)?$/.test(file) && !/\.(example|sample|template)$/.test(file)) return 'private environment filename';
  if (/\.sql(?:\.(?:gz|zip|enc))?$/.test(file)) return 'SQL file; review whether it contains private data';
  if (/(^|\/)(node_modules|vendor|dist)\//.test(file)) return 'generated dependency or build output';
  // This exact repository-root control file keeps uploaded documents ignored.
  // Its indexed rules are checked separately by Inspect-PassHistory.cjs.
  if (file === 'storage/app/private/.gitignore') return null;
  if (/(^|\/)storage\/app\/private\//.test(file)) return 'private application storage';
  return null;
}

function inspectRewrite(config) {
  const rule = Array.isArray(config?.rewrites) ? config.rewrites.find(item => item?.source === '/api/:path*') : null;
  if (!rule || typeof rule.destination !== 'string') return { status: 'REVIEW', message: 'No recognized API proxy rule; verify how the hosted website reaches Laravel.' };
  try {
    const url = new URL(rule.destination);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
      return { status: 'REVIEW', message: 'The hosted API rule needs review for HTTPS and embedded credentials/parameters. No destination value is printed.' };
    }
    return { status: 'REVIEW', message: 'Vercel API routing is pinned to one HTTPS destination. Confirm which backend/database previews and production use; local Vite proxy settings do not change this rule.' };
  } catch { return { status: 'REVIEW', message: 'API routing is not a literal HTTPS URL; verify the intended hosted proxy. No destination value is printed.' }; }
}

function gitRead(repo, args) {
  // Inspect this folder's own repository, not a GIT_DIR, GIT_INDEX_FILE,
  // worktree or injected configuration inherited from another shell operation.
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.toUpperCase().startsWith('GIT_')));
  env.GIT_TERMINAL_PROMPT = '0';
  try { return execFileSync('git', ['--no-pager', '-c', 'core.fsmonitor=false', '-C', repo, ...args], { env, encoding: 'utf8', timeout: 10000, maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }); }
  catch { return null; }
}

/** Compare real directories, including short paths, junctions and symlink aliases. */
function sameDirectory(first, second) {
  try {
    const a = fs.statSync(first, { bigint: true });
    const b = fs.statSync(second, { bigint: true });
    if (!a.isDirectory() || !b.isDirectory()) return false;
    if (a.dev !== 0n && b.dev !== 0n && a.ino !== 0n && b.ino !== 0n) return a.dev === b.dev && a.ino === b.ino;
    // Some filesystems do not expose stable IDs. Resolve aliases before using
    // path spelling as the fallback; path.resolve alone does not resolve them.
    const canonical = value => {
      const result = path.normalize(fs.realpathSync.native(value));
      return process.platform === 'win32' ? result.toLowerCase() : result;
    };
    return canonical(first) === canonical(second);
  } catch { return false; }
}

function inspectRepo(repo) {
  const top = gitRead(repo, ['rev-parse', '--show-toplevel']);
  if (top === null || !sameDirectory(top.trim(), repo)) return { repository: path.basename(repo), gitAvailable: false, tracked: [], history: null, message: 'This folder has no independent Git metadata or its root identity could not be verified; a parent repository is not substituted.' };
  const files = gitRead(repo, ['ls-files', '-z']);
  if (files === null) return { repository: path.basename(repo), gitAvailable: false, tracked: [], history: null, message: 'Git metadata unavailable; source archives do not verify repository history.' };
  const tracked = files.split('\0').filter(Boolean).map(file => ({ file, reason: classifyTrackedPath(file) })).filter(item => item.reason);
  const old = gitRead(repo, ['log', '--all', '--pretty=format:', '--name-only', '--', '*.sql', '*.sql.gz', '*.sql.zip', '*.sql.enc', '.env', '.env.*']);
  const history = old === null ? null : [...new Set(old.split(/\r?\n/).map(file => file.trim()).filter(file => file && classifyTrackedPath(file)))];
  return { repository: path.basename(repo), gitAvailable: true, tracked, history };
}

function inspectProject(root) {
  const checks = [];
  for (const name of REPOS) {
    const repo = path.join(root, name);
    const result = inspectRepo(repo);
    checks.push({ status: result.gitAvailable && result.tracked.length === 0 ? 'CHECKED' : 'REVIEW', area: name + ' current tracked filenames',
      message: result.gitAvailable ? (result.tracked.length ? 'Review ' + result.tracked.length + ' private/generated candidate filenames before publishing. A filename is not proof of exposure.' : 'No selected private/generated filename patterns are tracked. This is not a secret-content scan.' ) : result.message,
      candidates: result.tracked.map(item => ({ file: item.file, reason: item.reason })) });
    checks.push({ status: result.history && result.history.length === 0 ? 'CHECKED' : 'REVIEW', area: name + ' history filenames',
      message: result.history === null ? 'History was not available or the bounded query failed; review it separately.' : result.history.length ? 'SQL/environment candidates exist in history. Untracking leaves previous blobs; inspect privately whether they held real records or secrets.' : 'No selected SQL/environment filename patterns found in available history. Private-key content was not scanned.',
      candidate_count: result.history?.length ?? null });
  }
  let config;
  try { config = JSON.parse(fs.readFileSync(path.join(root, 'PASS-FE-REACT/vercel.json'), 'utf8')); }
  catch { checks.push({ status: 'REVIEW', area: 'Vercel API routing', message: 'Vercel configuration unavailable or invalid; hosted routing was not verified.' }); }
  if (config) checks.push({ area: 'Vercel API routing', ...inspectRewrite(config) });
  checks.push({ status: 'REVIEW', area: 'Runtime configuration', message: 'Actual hosted environment, HTTPS, private storage, database isolation, mail, workers and backups need runtime verification. No environment contents were read.' });
  checks.push({ status: 'REVIEW', area: 'A09', message: 'Keep the dependency finding open until a current audit and supported remediation/reachability review settle deepmerge (Jest), glob and minimatch.' });
  return { inspection: 'PASS local release source review', releaseCleared: false, checks, noDatabaseOrNetworkAccess: true };
}

function main() {
  if (process.argv.slice(2).some(arg => arg !== '--json')) throw new Error('Usage: node tools/Inspect-PassRelease.cjs [--json]');
  const root = path.resolve(__dirname, '../..');
  if (!REPOS.every(name => fs.existsSync(path.join(root, name)))) throw new Error('Keep the three PASS repositories beside each other in PASS-STAGING.');
  const result = inspectProject(root);
  if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else {
    for (const check of result.checks) {
      console.log(check.status + ' | ' + check.area + ' | ' + check.message);
      for (const item of check.candidates || []) console.log('  filename: ' + JSON.stringify(item.file) + ' | ' + item.reason);
    }
    console.log('INSPECTION COMPLETE | RELEASE NOT CLEARED. REVIEW is an unresolved assessment, not proof of an exploit.');
    console.log('No environment/SQL/document contents, Git history, database records or network services were changed.');
  }
}
if (require.main === module) {
  try { main(); } catch (error) { console.error('RELEASE INSPECTION STOPPED: ' + error.message); process.exitCode = 1; }
}
module.exports = { classifyTrackedPath, inspectRewrite, inspectRepo, inspectProject, sameDirectory };
