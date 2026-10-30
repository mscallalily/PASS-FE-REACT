import { ApiError, blobRequest, jsonRequest } from './http';
export { ApiError } from './http';
export function getToken(): string | null { return localStorage.getItem('pass_auth_token') || sessionStorage.getItem('pass_auth_token'); }
function headers(source?: HeadersInit): Headers {
  const token = getToken();
  if (!token) throw new ApiError('Your session has expired. Please log in again.', 401);
  const h = new Headers(source); h.set('Accept', 'application/json'); h.set('Authorization', `Bearer ${token}`); return h;
}
export async function apiRequest<T>(url: string, options: Omit<RequestInit, 'body'> & { body?: unknown } = {}): Promise<T> {
  const { body, ...rest } = options; const h = headers(rest.headers), form = body instanceof FormData;
  if (body !== undefined && !form) h.set('Content-Type', 'application/json');
  return jsonRequest<T>(url, { ...rest, headers: h, body: body === undefined ? undefined : form ? body : JSON.stringify(body) }, /\/(?:licenses|documents\/autofill|vehicles)(?:\/|$|\?)/.test(url) ? 120000 : 30000);
}
export function apiBlob(url: string): Promise<Blob> { return blobRequest(url, { headers: headers() }); }
