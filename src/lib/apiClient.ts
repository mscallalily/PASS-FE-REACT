// Authenticated requests to the Laravel API. Requests go through the Vite
// "/api" proxy and carry the Sanctum token saved at login.

const TOKEN_KEY = 'pass_auth_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fieldErrors: Record<string, string> = {},
    public retryAfterSeconds: number = 0,
  ) {
    super(message);
  }
}

async function send(url: string, options: RequestInit): Promise<Response> {
  const token = getToken();

  if (!token) {
    throw new ApiError('Your session has expired. Please log in again.', 401);
  }

  try {
    return await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers as Record<string, string> | undefined),
      },
    });
  } catch {
    throw new ApiError('Cannot reach the server. Please check your connection and try again.', 0);
  }
}

async function toError(response: Response): Promise<ApiError> {
  const data = await response.json().catch(() => ({}));
  const fieldErrors: Record<string, string> = {};

  for (const [field, messages] of Object.entries((data.errors ?? {}) as Record<string, string[]>)) {
    fieldErrors[field] = Array.isArray(messages) ? messages[0] : String(messages);
  }

  const retryHeader = response.headers.get('Retry-After');
  const headerSeconds = retryHeader && /^\d+$/.test(retryHeader) ? Number(retryHeader) : retryHeader ? Math.ceil((Date.parse(retryHeader) - Date.now()) / 1000) : 0;
  const retry = response.status === 429 ? Math.max(1, Math.min(3600, Number.isFinite(headerSeconds) && headerSeconds > 0 ? headerSeconds : Number(data.retry_after) || 60)) : 0;
  const message = response.status === 429 && (!data.message || /^too many (attempts|requests)\.?$/i.test(data.message)) ? `Please wait ${retry} seconds before trying again.` : data.message;
  return new ApiError(message || `Request failed with status ${response.status}.`, response.status, fieldErrors, retry);
}

/** JSON request. A plain-object body is sent as JSON; FormData is sent as multipart. */
export async function apiRequest<T>(url: string, options: Omit<RequestInit, 'body'> & { body?: unknown } = {}): Promise<T> {
  const { body, ...rest } = options;
  const isForm = body instanceof FormData;

  const response = await send(url, {
    ...rest,
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    headers: {
      ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
      ...(rest.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) throw await toError(response);

  return (await response.json().catch(() => ({}))) as T;
}

/** Download a protected file (e.g. an uploaded document) as a Blob. */
export async function apiBlob(url: string): Promise<Blob> {
  const response = await send(url, { headers: { Accept: 'application/json, */*' } });

  if (!response.ok) throw await toError(response);

  return response.blob();
}
