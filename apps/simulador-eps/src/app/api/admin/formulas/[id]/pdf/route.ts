import { NextRequest, NextResponse } from "next/server";
import { mapearFormulaDto } from "@/lib/formula-service";
import { generarPdfFormula } from "@/lib/pdf-formula";
import { prisma } from "@/lib/prisma";
import { problemResponse } from "@/lib/problem";
import { validarSesionOperador } from "@/lib/session";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authError = validarSesionOperador(request);
  if (authError) return authError;

  const { id } = await context.params;
  const formula = await prisma.formula.findUnique({
    where: { id },
    include: {
      paciente: true,
      medico: true,
      items: {
        include: { medicamento: true },
        orderBy: { medicamentoCodigo: "asc" },
      },
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

  const dto = mapearFormulaDto(formula);
  const pdfBytes = await generarPdfFormula(dto, {
    eps: formula.paciente.eps,
    medicoRegistro: formula.medico.registro,
    medicoEspecialidad: formula.medico.especialidad,
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${formula.codigo}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
