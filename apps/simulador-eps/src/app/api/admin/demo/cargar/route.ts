import { NextRequest, NextResponse } from "next/server";
import { cargarDatosDemo } from "@/lib/demo-service";
import { validarSesionOperador } from "@/lib/session";

export async function POST(request: NextRequest) {
  const authError = validarSesionOperador(request);
  if (authError) return authError;

  const resultado = await cargarDatosDemo();
  return NextResponse.json(resultado, { status: 200 });
}
