import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validarSesionOperador } from "@/lib/session";

export async function GET(request: NextRequest) {
  const authError = validarSesionOperador(request);
  if (authError) return authError;

  const medicos = await prisma.medico.findMany({
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json({ items: medicos });
}
