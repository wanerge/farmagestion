import { NextRequest, NextResponse } from "next/server";
import { reiniciarDatosDemo } from "@/lib/demo-service";
import { validarSesionOperador } from "@/lib/session";

export async function POST(request: NextRequest) {
  const authError = validarSesionOperador(request);
  if (authError) return authError;

  const resultado = await reiniciarDatosDemo();
  return NextResponse.json(resultado, { status: 200 });
}
