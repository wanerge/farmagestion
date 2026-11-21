import { NextRequest, NextResponse } from "next/server";
import { problemResponse } from "@/lib/problem";
import {
  aplicarCookieSesion,
  crearTokenSesion,
  limpiarCookieSesion,
  SESSION_COOKIE_NAME,
  verificarContrasenaOperador,
  verificarTokenSesion,
} from "@/lib/session";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return NextResponse.json({ autenticado: verificarTokenSesion(token) });
}

export async function POST(request: NextRequest) {
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return problemResponse({
      status: 400,
      title: "Error de validación",
      detail: "Debe enviar un JSON válido con el campo password.",
      code: "VALIDACION_ERROR",
    });
  }

  if (
    typeof body.password !== "string" ||
    !verificarContrasenaOperador(body.password)
  ) {
    return problemResponse({
      status: 401,
      title: "Credenciales inválidas",
      detail: "La contraseña de operador es incorrecta.",
      code: "API_KEY_INVALIDA",
    });
  }

  const token = crearTokenSesion();
  const response = NextResponse.json({ autenticado: true }, { status: 200 });
  aplicarCookieSesion(response, token);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ autenticado: false }, { status: 200 });
  limpiarCookieSesion(response);
  return response;
}
