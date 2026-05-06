import "server-only";

import { NextResponse } from "next/server";
import { backendFetch } from "./api-server";

export async function proxyJson(
  backendPath: string,
  init?: RequestInit,
): Promise<NextResponse> {
  const res = await backendFetch(backendPath, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json(err, { status: res.status });
  }
  return NextResponse.json(await res.json());
}

export async function proxyStream(
  request: Request,
  backendPath: string,
  defaultMime = "video/mp4",
): Promise<Response> {
  const upstreamHeaders = new Headers();
  const range = request.headers.get("Range");
  if (range) upstreamHeaders.set("Range", range);

  const res = await backendFetch(backendPath, { headers: upstreamHeaders });

  const headers = new Headers({
    "Content-Type": res.headers.get("Content-Type") ?? defaultMime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
  });
  const contentRange = res.headers.get("Content-Range");
  if (contentRange) headers.set("Content-Range", contentRange);
  const contentLength = res.headers.get("Content-Length");
  if (contentLength) headers.set("Content-Length", contentLength);

  return new Response(res.body, { status: res.status, headers });
}

export async function proxyDownload(backendPath: string): Promise<Response> {
  const res = await backendFetch(backendPath);

  const headers = new Headers({
    "Content-Type":
      res.headers.get("Content-Type") ?? "application/octet-stream",
    "Cache-Control": "no-store",
  });
  const contentDisposition = res.headers.get("Content-Disposition");
  if (contentDisposition) headers.set("Content-Disposition", contentDisposition);
  const contentLength = res.headers.get("Content-Length");
  if (contentLength) headers.set("Content-Length", contentLength);

  return new Response(res.body, { status: res.status, headers });
}
