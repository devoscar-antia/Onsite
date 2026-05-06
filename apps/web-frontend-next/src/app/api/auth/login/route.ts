import { setAuthCookies } from "@/lib/auth-cookies";
import { rotateCsrfToken } from "@/lib/csrf";
import { BACKEND_URL } from "@/lib/api-server";
import { checkLoginRateLimit } from "@/lib/rate-limit";
import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "");

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await checkLoginRateLimit(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Demasiados intentos. Intenta de nuevo más tarde." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid credentials format" },
      { status: 400 },
    );
  }

  // Forward to FastAPI
  let upstream: Response;
  try {
    const signal = AbortSignal.timeout(10_000);
    upstream = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
      signal,
    });
  } catch {
    return NextResponse.json(
      { error: "No se pudo conectar con el servidor. Intenta de nuevo." },
      { status: 503 },
    );
  }

  if (!upstream.ok) {
    const err = await upstream.json().catch(() => ({}));
    return NextResponse.json(
      { error: (err as { detail?: string }).detail ?? "Credenciales incorrectas" },
      { status: upstream.status },
    );
  }

  const tokens = (await upstream.json()) as {
    access_token: string;
    refresh_token: string;
  };

  // Decode role + email from the JWT directly — no second backend round trip
  let user: { id: string; email: string; role: string };
  try {
    const { payload } = await jwtVerify(tokens.access_token, JWT_SECRET, { algorithms: ["HS256"] });
    user = {
      id: String(payload.sub),
      email: String(payload.email ?? ""),
      role: String(payload.role ?? "viewer"),
    };
  } catch {
    return NextResponse.json({ error: "Error interno al validar sesión." }, { status: 500 });
  }

  await setAuthCookies(tokens);
  await rotateCsrfToken();

  return NextResponse.json({ user });
}
