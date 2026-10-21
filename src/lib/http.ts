/** Bounded API requests; writes are never retried automatically. */
export class ApiError extends Error {
  constructor(message: string, public status: number, public fieldErrors: Record<string, string> = {}, public retryAfterSeconds = 0, public code = '') { super(message); this.name = 'ApiError'; }
}
async function boundedFetch(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController(); let timedOut = false;
  const abort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const bytes = await response.arrayBuffer();
    return new Response([204, 205, 304].includes(response.status) ? null : bytes, { status: response.status, statusText: response.statusText, headers: response.headers });
  } catch {
    if (options.signal?.aborted && !timedOut) throw new DOMException('Request cancelled.', 'AbortError');
    const mutation = !['GET', 'HEAD'].includes((options.method || 'GET').toUpperCase());
    throw new ApiError(timedOut ? `The server took too long to respond.${mutation ? ' Check whether the change was saved before trying again.' : ' Please try again.'}` : 'Cannot reach the server. Please check your connection and try again.', 0, {}, 0, timedOut ? 'request_timeout' : 'network_error');
  } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); }
}
export async function jsonFetch(url: string, options: RequestInit = {}, timeoutMs = 30000): Promise<Response> {
  const response = await boundedFetch(url, options, timeoutMs);
  if (response.ok && response.status !== 204) {
    try {
      if (!response.headers.get('Content-Type')?.includes('application/json')) throw new Error();
      await response.clone().json();
    } catch { throw new ApiError('The server returned an incomplete or unexpected response. Please try again.', response.status, {}, 0, 'invalid_response'); }
  }
  if (new Headers(options.headers).has('Authorization') && [401, 403].includes(response.status)) {
    const data = await response.clone().json().catch(() => ({}));
    if (response.status === 401 || ['account_not_active', 'email_unverified'].includes(data.code)) window.dispatchEvent(new CustomEvent('pass-session-expired', { detail: { token: new Headers(options.headers).get('Authorization')?.replace(/^Bearer /, '') } }));
  }
  return response;
}
export async function responseError(response: Response): Promise<ApiError> {
  const data = await response.json().catch(() => ({})), fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(data.errors ?? {})) fields[key] = Array.isArray(value) ? String(value[0]) : String(value);
  const header = response.headers.get('Retry-After');
  const seconds = header && /^\d+$/.test(header) ? Number(header) : header ? Math.ceil((Date.parse(header) - Date.now()) / 1000) : Number(data.retry_after) || 60;
  const retry = response.status === 429 ? Math.max(1, Math.min(3600, Number.isFinite(seconds) ? seconds : 60)) : 0;
  const message = response.status === 429 && (!data.message || /^too many (attempts|requests)\.?$/i.test(data.message)) ? `Please wait ${retry} seconds before trying again.` : data.message;
  return new ApiError(message || `Request failed with status ${response.status}.`, response.status, fields, retry, data.code || '');
}
export async function jsonRequest<T>(url: string, options: RequestInit = {}, timeoutMs = 30000): Promise<T> {
  const response = await jsonFetch(url, options, timeoutMs);
  if (!response.ok) throw await responseError(response);
  return response.status === 204 ? undefined as T : response.json();
}
export async function blobRequest(url: string, options: RequestInit = {}): Promise<Blob> {
  const response = await boundedFetch(url, options, 60000);
  if (!response.ok) throw await responseError(response);
  return response.blob();
}
