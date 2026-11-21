import { NextRequest, NextResponse } from "next/server";
import { validarApiKey } from "@/lib/api-key";
import { mapearFormulaDto } from "@/lib/formula-service";
import { generarPdfFormula } from "@/lib/pdf-formula";
import { prisma } from "@/lib/prisma";
import { fromErrorToProblem, problemResponse } from "@/lib/problem";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ codigo: string }> }
) {
  const authError = validarApiKey(request);
  if (authError) return authError;

  try {
    const { codigo } = await context.params;
    const documento = request.nextUrl.searchParams.get("documento")?.trim();

    if (!documento) {
      return problemResponse({
        status: 404,
        title: "Fórmula no encontrada",
        detail:
          "No se encontró una fórmula que coincida con el código y documento indicados.",
        code: "FORMULA_NO_ENCONTRADA",
      });
    }

    const formula = await prisma.formula.findUnique({
      where: { codigo },
      include: {
        paciente: true,
        medico: true,
        items: {
          include: { medicamento: true },
          orderBy: { medicamentoCodigo: "asc" },
        },
      },
    });

    if (!formula || formula.paciente.documento !== documento) {
      return problemResponse({
        status: 404,
        title: "Fórmula no encontrada",
        detail:
          "No se encontró una fórmula que coincida con el código y documento indicados.",
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
  } catch (error) {
    return fromErrorToProblem(error);
  }
}
