import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { problemResponse, type ProblemBody } from "./problem";

export const SESSION_COOKIE_NAME = "sim_eps_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 horas

function obtenerSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET no configurado o demasiado corto.");
  }
  return secret;
}

function firmar(payloadB64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

export function crearTokenSesion(ahoraMs: number = Date.now()): string {
  const secret = obtenerSessionSecret();
  const exp = Math.floor(ahoraMs / 1000) + SESSION_TTL_SECONDS;
  const payloadB64 = Buffer.from(
    JSON.stringify({ rol: "OPERADOR", exp }),
    "utf-8"
  ).toString("base64url");
  const sig = firmar(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

export function verificarTokenSesion(
  token: string | undefined,
  ahoraMs: number = Date.now()
): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [payloadB64, providedSig] = parts;
  let secret: string;
  try {
    secret = obtenerSessionSecret();
  } catch {
    return false;
  }

  const expectedSig = firmar(payloadB64, secret);
  const a = Buffer.from(providedSig, "utf-8");
  const b = Buffer.from(expectedSig, "utf-8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf-8")
    ) as { rol?: string; exp?: number };
    if (payload.rol !== "OPERADOR" || typeof payload.exp !== "number") {
      return false;
    }
    return payload.exp > Math.floor(ahoraMs / 1000);
  } catch {
    return false;
  }
}

export function verificarContrasenaOperador(password: string): boolean {
  const expected = process.env.DEMO_ADMIN_PASSWORD;
  if (!expected || !password) return false;
  const a = Buffer.from(password, "utf-8");
  const b = Buffer.from(expected, "utf-8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function aplicarCookieSesion(
  response: NextResponse,
  token: string
): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function limpiarCookieSesion(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function validarSesionOperador(
  request: NextRequest
): NextResponse<ProblemBody> | null {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!verificarTokenSesion(token)) {
    return problemResponse({
      status: 401,
      title: "Sesión requerida",
      detail: "Debe iniciar sesión como operador para acceder a este recurso.",
      code: "API_KEY_INVALIDA",
    });
  }
  return null;
}
