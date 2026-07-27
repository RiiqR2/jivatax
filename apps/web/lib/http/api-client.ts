const API_PREFIX = '/api';

export type ApiErrorKind = 'configuration' | 'network' | 'validation' | 'not-found' | 'conflict' | 'server';

export class ApiError extends Error {
  readonly status?: number;
  readonly kind: ApiErrorKind;

  constructor(
    message: string,
    status?: number,
    kind: ApiErrorKind = 'server',
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.kind = kind;
  }
}

export function buildApiUrl(baseUrl: string, path: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (!base) throw new ApiError('La dirección de la API no está configurada.', undefined, 'configuration');
  const baseWithPrefix = base.endsWith(API_PREFIX) ? base : `${base}${API_PREFIX}`;
  return `${baseWithPrefix}/${path.replace(/^\/+/, '')}`;
}

function errorKind(status: number): ApiErrorKind {
  if (status === 400) return 'validation';
  if (status === 404) return 'not-found';
  if (status === 409) return 'conflict';
  return 'server';
}

function messageFromBody(body: unknown, fallback: string): string {
  if (typeof body !== 'object' || body === null || !('message' in body)) return fallback;
  const message = body.message;
  return Array.isArray(message) ? message.join(', ') : String(message);
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
  const url = buildApiUrl(configuredApiUrl, path);
  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(
      'No se pudo conectar con la API. Verifica que el servidor esté disponible.',
      undefined,
      'network',
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  const body: unknown = response.status === 204
    ? undefined
    : contentType.includes('application/json')
      ? await response.json().catch(() => undefined)
      : await response.text().catch(() => undefined);

  if (!response.ok) {
    throw new ApiError(
      messageFromBody(body, `La solicitud no pudo completarse (${response.status}).`),
      response.status,
      errorKind(response.status),
    );
  }
  return body as T;
}
