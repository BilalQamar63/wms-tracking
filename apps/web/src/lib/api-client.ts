import type { ApiResponse } from '@wms/shared';

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/** Typed fetch wrapper that unwraps `{ success, data }` envelopes and throws readable errors. */
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData;
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body && !isForm ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  let body: ApiResponse<T> | null = null;
  try {
    body = (await response.json()) as ApiResponse<T>;
  } catch {
    /* non-JSON response */
  }

  if (!response.ok || !body || !body.success) {
    const failure = body && !body.success ? body.error : undefined;
    if (response.status === 401 && typeof window !== 'undefined' && !url.includes('/auth/')) {
      window.location.href = '/login';
    }
    throw new ApiClientError(
      failure?.message ?? `Request failed (${response.status})`,
      response.status,
      failure?.code,
    );
  }
  return body.data;
}

export const swrFetcher = <T,>(url: string): Promise<T> => apiFetch<T>(url);

/** Builds `?a=1&b=2`, skipping empty values. */
export function toQueryString(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

/** Triggers a browser download for a binary API response. */
export async function downloadFromApi(url: string, fallbackName: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    let message = `Download failed (${response.status})`;
    try {
      const body = (await response.json()) as ApiResponse<unknown>;
      if (!body.success) message = body.error.message;
    } catch {
      /* ignore */
    }
    throw new ApiClientError(message, response.status);
  }
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const fileName = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? fallbackName;

  const blobUrl = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(blobUrl);
  return fileName;
}
