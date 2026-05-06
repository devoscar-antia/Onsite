const API_BASE = "/api/proxy";
const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";

function getCsrfToken(): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : "";
}

function csrfHeaders(): Record<string, string> {
  const token = getCsrfToken();
  return token ? { [CSRF_HEADER]: token } : {};
}

class ApiError extends Error {
  constructor(
    public status: number,
    public data: unknown,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function fetchWithRefresh(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  let res = await fetch(url, init);

  if (res.status === 401) {
    const refreshRes = await fetch("/api/auth/refresh", { method: "POST" });
    if (refreshRes.ok) {
      res = await fetch(url, init);
    } else {
      // Refresh failed — boot user to login
      window.location.href = "/login";
      return res;
    }
  }

  return res;
}

async function throwOnError(res: Response): Promise<void> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data, `API ${res.status}`);
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetchWithRefresh(`${API_BASE}${path}`);
  await throwOnError(res);
  return res.json();
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetchWithRefresh(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...csrfHeaders() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  await throwOnError(res);
  return res.json();
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithRefresh(`${API_BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...csrfHeaders() },
    body: JSON.stringify(body),
  });
  await throwOnError(res);
  return res.json();
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithRefresh(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...csrfHeaders() },
    body: JSON.stringify(body),
  });
  await throwOnError(res);
  return res.json();
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetchWithRefresh(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: csrfHeaders(),
  });
  await throwOnError(res);
}

export { ApiError };
