import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compiled = ts.transpileModule(readFileSync(new URL('../src/lib/http.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { jsonRequest, jsonFetch } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
globalThis.window = new EventTarget();
let server, base, writes = 0;
before(async () => {
  server = createServer((req, res) => {
    if (req.url === '/stall-headers') return;
    if (req.url === '/write') { writes++; res.writeHead(200, { 'Content-Type': 'application/json' }); res.write('{'); return; }
    if (req.url === '/stall-body') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.write('{'); return; }
    if (req.url === '/html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<html>proxy failure</html>'); return; }
    if (req.url === '/invalid') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{'); return; }
    if (req.url === '/limit') { res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '17' }); res.end(JSON.stringify({ message: 'Too Many Attempts.' })); return; }
    if (req.url === '/expired') { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end('{"message":"Unauthenticated."}'); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"saved":true}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = 'http://127.0.0.1:' + server.address().port;
});
after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
test('reads a valid JSON response', async () => assert.deepEqual(await jsonRequest(base + '/ok'), { saved: true }));
test('rejects HTML that a proxy incorrectly labels successful', async () => assert.rejects(jsonRequest(base + '/html'), e => e.code === 'invalid_response'));
test('rejects truncated JSON instead of fabricating an empty success', async () => assert.rejects(jsonRequest(base + '/invalid'), e => e.code === 'invalid_response'));
test('bounds time waiting for response headers', async () => assert.rejects(jsonRequest(base + '/stall-headers', {}, 70), e => e.code === 'request_timeout'));
test('bounds time waiting for a stalled response body', async () => assert.rejects(jsonRequest(base + '/stall-body', {}, 70), e => e.code === 'request_timeout'));
test('does not retry a mutation with an uncertain outcome', async () => { await assert.rejects(jsonRequest(base + '/write', { method: 'POST' }, 70), /Check whether the change was saved/); assert.equal(writes, 1); });
test('reports offline/network failures', async () => assert.rejects(jsonRequest('http://127.0.0.1:1/offline', {}, 200), e => e.code === 'network_error'));
test('honors caller cancellation', async () => { const c = new AbortController(); c.abort(); await assert.rejects(jsonRequest(base + '/ok', { signal: c.signal }), e => e.name === 'AbortError'); });
test('preserves the server retry-after value', async () => assert.rejects(jsonRequest(base + '/limit'), e => e.status === 429 && e.retryAfterSeconds === 17));
test('expired authorized responses identify which token expired', async () => { let expected; window.addEventListener('pass-session-expired', e => { expected = e.detail.token; }, { once: true }); const r = await jsonFetch(base + '/expired', { headers: { Authorization: 'Bearer test-token' } }); assert.equal(r.status, 401); assert.equal(expected, 'test-token'); });
