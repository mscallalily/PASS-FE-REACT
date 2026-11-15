#!/usr/bin/env node
'use strict';
// Targeted local triage, not a complete secret scanner or release clearance.
// Selected historical blobs are read into memory; values/rows are never printed.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { TextDecoder } = require('node:util');
const { sameDirectory } = require('./Inspect-PassRelease.cjs');

const REPOS = ['PASS-BE-LARAVEL', 'PASS-FE-REACT', 'PASS-FE-NATIVE'];
const LIMITS = Object.freeze({ objects: 4000, blobs: 120, blobBytes: 4 * 1024 * 1024, totalBytes: 32 * 1024 * 1024, milliseconds: 40000 });
const SELECTORS = ['**/*.sql', '**/*.sql.gz', '**/*.sql.zip', '**/*.sql.enc', '**/.env', '**/.env.*'].map(p => ':(glob,icase)' + p)
  .concat(['example', 'sample', 'template'].map(p => ':(exclude,glob,icase)**/.env*.' + p));
const SECRET_KEYS = new Set(['APP_KEY', 'DB_PASSWORD', 'MAIL_PASSWORD', 'REDIS_PASSWORD', 'AWS_SECRET_ACCESS_KEY', 'RESEND_KEY', 'POSTMARK_TOKEN', 'OPENAI_API_KEY', 'GITHUB_TOKEN', 'NPM_TOKEN', 'SLACK_BOT_USER_OAUTH_TOKEN', 'RFID_READER_SECRET', 'RFID_API_KEY', 'HARDWARE_API_KEY']);
const TABLES = new Set(['users', 'user_profiles', 'driver_licenses', 'visitors', 'visitor_requests', 'visitor_passes', 'rfid_readers', 'personal_access_tokens', 'password_reset_tokens', 'email_verification_codes', 'registration_sessions', 'privileged_account_invitations', 'system_settings', 'mobile_devices', 'notifications', 'audit_logs', 'login_attempts', 'vehicles', 'vehicle_authorizations', 'rfid_tags', 'rfid_assignments', 'parking_transactions', 'parking_violations', 'violation_evidences', 'access_events', 'barrier_commands']);
const OID = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const SCOPE = 'Selected SQL and non-template .env versions reachable from existing local Git refs; current private-storage ignore rules from the index. No remote, reflog-only, unreachable or uncommitted-content scan.';

function gitReader(repo, deadline) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('GIT_')));
  Object.assign(env, { GIT_TERMINAL_PROMPT: '0', GIT_NO_REPLACE_OBJECTS: '1', GIT_NO_LAZY_FETCH: '1', GIT_OPTIONAL_LOCKS: '0' });
  return (args, input, maxBuffer = 1024 * 1024) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('TIME_LIMIT');
    try {
      return execFileSync('git', ['--no-pager', '--no-lazy-fetch', '-c', 'core.fsmonitor=false', '-c', 'log.showSignature=false', '-C', repo, ...args], {
        env, input, maxBuffer, timeout: Math.min(10000, remaining), windowsHide: true, stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'ignore'],
      });
    } catch { throw new Error('GIT_READ_FAILED'); } // Never echo Git output/errors, paths or object contents.
  };
}

function decodeText(bytes) {
  try {
    let encoding = 'utf-8';
    if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'utf-16le';
    else if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = 'utf-16be';
    const text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) return null;
    return text;
  } catch { return null; }
}

// Mask comments and quoted values in one pass before looking for SQL headers.
// Backtick identifiers remain internal; only fixed allowlisted table names leave this function.
function maskSql(text) {
  const result = text.split(''); let quote = null, line = false, block = false, executableData = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (line) { if (c === '\n' || c === '\r') line = false; else result[i] = ' '; continue; }
    if (block) { result[i] = c === '\n' ? '\n' : ' '; if (c === '*' && next === '/') { result[++i] = ' '; block = false; } continue; }
    if (quote) {
      if (quote !== '`') result[i] = c === '\n' ? '\n' : ' ';
      if (c === '\\' && quote !== '`' && next !== undefined) { result[++i] = next === '\n' ? '\n' : ' '; }
      else if (c === quote) { if (next === quote) { if (quote !== '`') result[i + 1] = ' '; i++; } else quote = null; }
      continue;
    }
    if (c === '#' || (c === '-' && next === '-' && /\s/.test(text[i + 2] || ' '))) { line = true; result[i] = ' '; continue; }
    if (c === '/' && next === '*') {
      if (/^\/\*!\d*\s*(?:INSERT|REPLACE)\b/i.test(text.slice(i, i + 80))) executableData = true;
      block = true; result[i] = ' '; result[++i] = ' '; continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; if (c !== '`') result[i] = ' '; }
  }
  return { text: result.join(''), incomplete: Boolean(quote || block), executableData };
}

function analyzeText(text) {
  const credentials = new Set();
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || !SECRET_KEYS.has(match[1])) continue;
    let value = match[2];
    if (!value.startsWith('"') && !value.startsWith("'")) value = value.replace(/\s+#.*$/, '').trim();
    if (value !== '' && value !== '""' && value !== "''" && !value.startsWith('#')) credentials.add(match[1]);
  }
  const masked = maskSql(text), tables = {}, gaps = [];
  const id = '(?:`(?:``|[^`])+`|[a-z_][a-z0-9_$]*)';
  const inserts = new RegExp('\\b(?:INSERT(?:\\s+(?:LOW_PRIORITY|DELAYED|HIGH_PRIORITY|IGNORE))*|REPLACE(?:\\s+(?:LOW_PRIORITY|DELAYED))*)\\s+(?:INTO\\s+)?(' + id + '(?:\\s*\\.\\s*' + id + ')?)\\s*(?:\\([^)]{0,8192}\\)\\s*)?(?:VALUES|VALUE)\\s*\\(', 'gi');
  let unknownTables = 0;
  for (const match of masked.text.matchAll(inserts)) {
    const table = match[1].split('.').at(-1).trim().replace(/^`|`$/g, '').replace(/``/g, '`').toLowerCase();
    if (TABLES.has(table)) tables[table] = (tables[table] || 0) + 1; else unknownTables++;
  }
  // Dotenv quote syntax is not SQL. Only flag syntax gaps for apparent SQL text.
  const apparentSql = /\b(?:CREATE\s+TABLE|INSERT\s+(?:INTO|IGNORE)|REPLACE\s+INTO)\b/i.test(masked.text);
  if (apparentSql && masked.incomplete) gaps.push('incomplete SQL quote/comment; manual review needed');
  if (masked.executableData) gaps.push('executable SQL data comment needs manual review');
  return { credentialKeys: [...credentials].sort(), privateKeyMarker: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/.test(text), tables, unknownTables, gaps };
}

function privateIgnore(git) {
  const file = 'storage/app/private/.gitignore';
  const raw = git(['ls-files', '--stage', '-z', '--', file]).toString('utf8');
  if (!raw) return { status: 'REVIEW', message: 'Protection file is absent from this index; verify private-upload ignore policy.' };
  const match = /^(100644|100755) ([a-f0-9]{40}|[a-f0-9]{64}) 0\tstorage\/app\/private\/\.gitignore\0$/.exec(raw);
  if (!match) return { status: 'REVIEW', message: 'Protection file is linked, conflicted or not a regular indexed file.' };
  const size = git(['cat-file', '-s', match[2]]).toString('ascii').trim();
  if (!/^\d+$/.test(size) || Number(size) > 8192) return { status: 'REVIEW', message: 'Protection file exceeds the bounded rules check.' };
  const text = decodeText(git(['cat-file', 'blob', match[2]], undefined, 8193));
  const rules = text?.split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'));
  return rules?.length === 2 && rules[0] === '*' && rules[1] === '!.gitignore'
    ? { status: 'CHECKED_SCOPE', message: 'Indexed protection rules match the expected deny-all pattern. Its contents were not printed.' }
    : { status: 'REVIEW', message: 'Indexed protection rules differ from the expected pattern; inspect privately. No rule contents printed.' };
}

function selectedVersions(raw) {
  const tokens = raw.toString('utf8').split('\0'), versions = new Map(); let nonRegular = false;
  for (let i = 0; i < tokens.length;) {
    const header = tokens[i++]; if (!header.trim()) continue;
    const match = /^\n*:(\d{6}) (\d{6}) ([a-f0-9]{40}|[a-f0-9]{64}) ([a-f0-9]{40}|[a-f0-9]{64}) [ADMUTX]$/.exec(header);
    if (!match || i >= tokens.length) throw new Error('INVALID_METADATA');
    const file = tokens[i++], base = file.split('/').at(-1).toLowerCase();
    const sql = /\.sql(?:\.(?:gz|zip|enc))?$/.test(base);
    const env = /^\.env(?:\.[^/]*)?$/.test(base) && !/\.(example|sample|template)$/.test(base);
    if (!sql && !env) continue;
    for (const [mode, id] of [[match[1], match[3]], [match[2], match[4]]]) {
      if (/^0+$/.test(id) && mode === '000000') continue;
      if (!['100644', '100755'].includes(mode)) { nonRegular = true; continue; }
      if (!OID.test(id) || /^0+$/.test(id)) throw new Error('INVALID_METADATA');
      const opaque = /\.sql\.(gz|zip|enc)$/.test(base);
      versions.set(id, { id, opaque: opaque || versions.get(id)?.opaque || false });
    }
  }
  return { versions: [...versions.values()], nonRegular };
}

function inspectHistory(repo, options = {}) {
  const limits = { ...LIMITS, ...options.limits }, deadline = options.deadline ?? Date.now() + limits.milliseconds;
  const name = path.basename(repo), label = REPOS.includes(name) ? name : 'requested repository';
  const result = { repository: label, gitAvailable: false, status: 'REVIEW', selectedBlobs: 0, analyzedTextBlobs: 0, skippedBlobs: 0, credentialCandidates: {}, privateKeyMarkerBlobs: 0, sqlStatementCandidates: {}, unclassifiedSqlStatements: 0, gaps: [], protection: null };
  const gap = message => { if (!result.gaps.includes(message)) result.gaps.push(message); };
  try {
    const git = gitReader(repo, deadline);
    const top = git(['rev-parse', '--show-toplevel']).toString('utf8').trim();
    if (!sameDirectory(top, repo)) { gap('independent repository root could not be verified; parent history not substituted'); return result; }
    result.gitAvailable = true;
    if (git(['rev-parse', '--is-shallow-repository']).toString('ascii').trim() !== 'false') gap('shallow or unverified history; older versions may be missing');
    if (name === 'PASS-BE-LARAVEL') result.protection = privateIgnore(git);
    // Raw, NUL-delimited file diffs enumerate old/new blob IDs without the
    // nested-tree omissions of rev-list --objects combined with path filters.
    // --root and -m include initial additions and each merge parent's changes.
    const selected = selectedVersions(git(['log', '--all', '--full-history', '--root', '-m', '--format=', '--raw', '-z', '--no-renames', '--no-abbrev', '--no-color', '--no-notes', '--no-decorate', '--no-ext-diff', '--no-textconv', '--', ...SELECTORS], undefined, 4 * 1024 * 1024));
    if (selected.nonRegular) gap('selected symlink or non-regular file version was not followed');
    const ids = selected.versions.map(item => item.id), opaqueIds = new Set(selected.versions.filter(item => item.opaque).map(item => item.id));
    if (ids.length > limits.objects) { gap('object-count limit reached; selection not analyzed'); return result; }
    if (ids.length) {
      const metadata = git(['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'], ids.join('\n') + '\n').toString('ascii').trim().split(/\r?\n/);
      if (metadata.length !== ids.length) { gap('object metadata incomplete; selection not analyzed'); return result; }
      const blobs = [];
      for (let i = 0; i < metadata.length; i++) {
        const match = /^([a-f0-9]{40}|[a-f0-9]{64}) (blob) (\d+)$/.exec(metadata[i]);
        if (!match || match[1] !== ids[i] || !Number.isSafeInteger(Number(match[3]))) { gap('missing or invalid local object; no lazy fetch attempted'); return result; }
        if (match[2] === 'blob') blobs.push({ id: match[1], size: Number(match[3]) });
      }
      result.selectedBlobs = blobs.length; let bytesRead = 0;
      for (let i = 0; i < blobs.length; i++) {
        const blob = blobs[i];
        if (i >= limits.blobs || Date.now() >= deadline) { result.skippedBlobs += blobs.length - i; gap('blob-count or elapsed-time limit reached'); break; }
        if (opaqueIds.has(blob.id)) { result.skippedBlobs++; gap('compressed/encrypted SQL filename; contents not unpacked or decrypted'); continue; }
        if (blob.size > limits.blobBytes || bytesRead + blob.size > limits.totalBytes) { result.skippedBlobs++; gap('blob-size or total-byte limit reached'); continue; }
        let bytes;
        try { bytes = git(['cat-file', 'blob', blob.id], undefined, limits.blobBytes + 1); }
        catch { result.skippedBlobs++; gap('local blob could not be read within bounds'); continue; }
        bytesRead += bytes.length;
        const text = bytes.length === blob.size ? decodeText(bytes) : null;
        if (text === null) { result.skippedBlobs++; gap('binary, compressed, encrypted or unsupported text needs private review'); continue; }
        result.analyzedTextBlobs++;
        const findings = analyzeText(text);
        for (const key of findings.credentialKeys) result.credentialCandidates[key] = (result.credentialCandidates[key] || 0) + 1;
        if (findings.privateKeyMarker) result.privateKeyMarkerBlobs++;
        for (const [table, count] of Object.entries(findings.tables)) result.sqlStatementCandidates[table] = (result.sqlStatementCandidates[table] || 0) + count;
        result.unclassifiedSqlStatements += findings.unknownTables;
        for (const message of findings.gaps) gap(message);
      }
    }
    const findings = Object.keys(result.credentialCandidates).length || result.privateKeyMarkerBlobs || Object.keys(result.sqlStatementCandidates).length || result.unclassifiedSqlStatements;
    result.status = findings || result.gaps.length || result.protection?.status === 'REVIEW' ? 'REVIEW' : 'CHECKED_SCOPE';
  } catch { gap('Git read unavailable, timed out or unsupported; coverage incomplete. Git 2.49+ recommended.'); }
  return result;
}

function inspectProject(root) {
  const deadline = Date.now() + LIMITS.milliseconds;
  return { inspection: 'PASS targeted local history triage', scope: SCOPE, releaseCleared: false, noDatabaseOrNetworkAccess: true, limits: LIMITS, repositories: REPOS.map(name => inspectHistory(path.join(root, name), { deadline })) };
}

function formatReport(result) {
  const lines = ['PASS HISTORY TRIAGE | READ ONLY | REDACTED OUTPUT', 'Scope: ' + SCOPE];
  for (const repo of result.repositories) {
    lines.push(repo.status + ' | ' + repo.repository + ' | selected blobs: ' + repo.selectedBlobs + '; text analyzed: ' + repo.analyzedTextBlobs + '; skipped: ' + repo.skippedBlobs);
    if (repo.protection) lines.push('  ' + repo.protection.status + ' | private-storage ignore policy | ' + repo.protection.message);
    for (const [key, count] of Object.entries(repo.credentialCandidates)) lines.push('  REVIEW | credential candidate ' + key + ' | blobs: ' + count + ' (values withheld; live validity not tested)');
    for (const [table, count] of Object.entries(repo.sqlStatementCandidates)) lines.push('  REVIEW | SQL data-statement candidate ' + table + ' | statements: ' + count + ' (not a person/row count; demo vs real unverified)');
    if (repo.unclassifiedSqlStatements) lines.push('  REVIEW | unclassified SQL data-statement candidates: ' + repo.unclassifiedSqlStatements + ' (table names withheld)');
    if (repo.privateKeyMarkerBlobs) lines.push('  REVIEW | private-key marker blobs: ' + repo.privateKeyMarkerBlobs + ' (contents withheld)');
    for (const message of repo.gaps) lines.push('  COVERAGE GAP | ' + message);
  }
  lines.push('TRIAGE COMPLETE | RELEASE NOT CLEARED. CHECKED_SCOPE is limited to these patterns, not proof that a repository is free of secrets.', 'No values, SQL rows, personal filenames or Git error details printed. No database, network, credentials, Git history or source files changed.');
  return lines.join('\n');
}

if (require.main === module) {
  try {
    if (process.argv.slice(2).some(arg => arg !== '--json')) throw new Error('USAGE');
    const root = path.resolve(__dirname, '../..');
    if (!REPOS.every(name => fs.existsSync(path.join(root, name)))) throw new Error('PROJECT');
    const result = inspectProject(root);
    console.log(process.argv.includes('--json') ? JSON.stringify(result, null, 2) : formatReport(result));
  } catch { console.error('HISTORY TRIAGE STOPPED: keep the three PASS repositories beside each other; run node tools/Inspect-PassHistory.cjs [--json]. No private error details printed.'); process.exitCode = 1; }
}
module.exports = { analyzeText, decodeText, inspectHistory, inspectProject, formatReport };
