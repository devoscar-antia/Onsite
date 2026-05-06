import "server-only";

import { getAccessToken } from "./auth-cookies";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function backendFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const token = await getAccessToken();

  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  // Don't set Content-Type for FormData — browser (or Node) adds the boundary
  if (!headers.has("Content-Type") && !(init?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const signal = init?.signal ?? AbortSignal.timeout(15_000);
  return fetch(`${BACKEND_URL}${path}`, { ...init, headers, signal });
}

/** Minimal version for Route Handlers that already have a token in hand */
export function backendFetchWithToken(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && !(init?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${BACKEND_URL}${path}`, { ...init, headers });
}

export { BACKEND_URL };
