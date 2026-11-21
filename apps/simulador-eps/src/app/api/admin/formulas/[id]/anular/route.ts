import { NextRequest, NextResponse } from "next/server";
import { calcularEstadoEfectivo } from "@/lib/formula-service";
import { prisma } from "@/lib/prisma";
import { problemResponse } from "@/lib/problem";
import { validarSesionOperador } from "@/lib/session";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authError = validarSesionOperador(request);
  if (authError) return authError;

  const { id } = await context.params;
  const formula = await prisma.formula.findUnique({
    where: { id },
    include: {
      _count: { select: { dispensaciones: true } },
    },
  });

  if (!formula) {
    return problemResponse({
      status: 404,
      title: "Fórmula no encontrada",
      detail: "No existe una fórmula con el identificador indicado.",
      code: "FORMULA_NO_ENCONTRADA",
    });
  }

  const estadoEfectivo = calcularEstadoEfectivo(
    formula.estado,
    formula.fechaVencimiento
  );

  if (estadoEfectivo !== "EMITIDA" || formula._count.dispensaciones > 0) {
    return problemResponse({
      status: 409,
      title: "Fórmula no anulable",
      detail:
        "Solo se puede anular una fórmula en estado EMITIDA sin dispensaciones (RF-EPS-06).",
      code: "FORMULA_NO_DISPENSABLE",
    });
  }

  const actualizada = await prisma.formula.update({
    where: { id },
    data: { estado: "ANULADA" },
  });

  return NextResponse.json({
    id: actualizada.id,
    codigo: actualizada.codigo,
    estado: actualizada.estado,
  });
}
