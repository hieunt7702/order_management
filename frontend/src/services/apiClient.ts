import { useAuthStore } from '../stores/authStore';

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export function buildQuery(params?: Record<string, any>): string {
  if (!params) return '';
  const clean: Record<string, string> = {};
  Object.entries(params).forEach(([k, val]) => {
    if (
      val !== undefined &&
      val !== null &&
      val !== '' &&
      val !== 'undefined' &&
      val !== 'null' &&
      val !== 'ALL'
    ) {
      clean[k] = String(val);
    }
  });
  const qs = new URLSearchParams(clean).toString();
  return qs ? `?${qs}` : '';
}

export interface RequestOptions extends RequestInit {
  _retry?: boolean;
}

export interface ApiError extends Error {
  statusCode?: number;
  errorCode?: string;
  details?: any;
  requestId?: string;
}

export async function request<T = any>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL}${endpoint}`;
  const { accessToken, currentTenant, refreshToken, setTokens, logout } =
    useAuthStore.getState();

  const headers = new Headers(options.headers || {});

  // Do not set Content-Type if body is FormData
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  if (currentTenant?.id) {
    headers.set('X-Tenant-Id', currentTenant.id);
  }

  const config: RequestOptions = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);

    // If 401 Unauthorized, attempt Token Rotation Refresh
    if (response.status === 401 && !options._retry && refreshToken) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((newToken) => {
            headers.set('Authorization', `Bearer ${newToken}`);
            return fetch(url, config).then(handleResponse);
          })
          .catch((err) => Promise.reject(err)) as Promise<T>;
      }

      options._retry = true;
      isRefreshing = true;

      try {
        const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (!refreshRes.ok) {
          throw new Error('Refresh token expired');
        }

        const refreshJson = await refreshRes.json();
        const newTokens = refreshJson.data || refreshJson;

        setTokens(newTokens.accessToken, newTokens.refreshToken);
        processQueue(null, newTokens.accessToken);

        headers.set('Authorization', `Bearer ${newTokens.accessToken}`);
        return (fetch(url, config).then(handleResponse)) as Promise<T>;
      } catch (refreshErr) {

        processQueue(refreshErr, null);
        logout();
        window.location.href = '/login';
        throw refreshErr;
      } finally {
        isRefreshing = false;
      }
    }

    return handleResponse<T>(response);
  } catch (err) {
    throw err;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  const isJson = response.headers
    .get('content-type')
    ?.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const error: ApiError = new Error(
      data?.message ||
        data?.error ||
        `HTTP error ${response.status}: ${response.statusText}`,
    );
    error.statusCode = response.status;
    error.errorCode = data?.errorCode;
    error.details = data?.details;
    error.requestId = data?.requestId;
    throw error;
  }

  // Un-envelope TransformInterceptor payload if present
  if (data && typeof data === 'object' && 'data' in data && 'success' in data) {
    return data.data;
  }

  return data;
}

export const api = {
  get: <T = any>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'GET' }),
  post: <T = any>(endpoint: string, body?: any, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  patch: <T = any>(endpoint: string, body?: any, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  put: <T = any>(endpoint: string, body?: any, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  delete: <T = any>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};
