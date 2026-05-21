import "server-only";

import { getAccessToken } from "./auth-cookies";

const BACKEND_URL = (() => {
  const url = process.env.BACKEND_URL;
  if (!url) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("BACKEND_URL env var is required in production");
    }
    return "http://localhost:8000";
  }
  return url;
})();

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

  // Streaming endpoints (video) must not be killed by a short timeout — callers
  // that need a deadline should pass their own signal via init.signal.
  const signal = init?.signal ?? (path.includes("/stream") ? undefined : AbortSignal.timeout(30_000));
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
