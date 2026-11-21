import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validarSesionOperador } from "@/lib/session";

export async function GET(request: NextRequest) {
  const authError = validarSesionOperador(request);
  if (authError) return authError;

  const medicamentos = await prisma.medicamentoCatalogo.findMany({
    orderBy: { codigo: "asc" },
  });
  return NextResponse.json({ items: medicamentos });
}
