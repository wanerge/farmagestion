import { NextRequest, NextResponse } from "next/server";
import { validarApiKey } from "@/lib/api-key";
import { consultarFormulaServicio } from "@/lib/formula-service";
import { fromErrorToProblem } from "@/lib/problem";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ codigo: string }> }
) {
  const authError = validarApiKey(request);
  if (authError) return authError;

  try {
    const { codigo } = await context.params;
    const documento = request.nextUrl.searchParams.get("documento");
    const formula = await consultarFormulaServicio(codigo, documento);
    return NextResponse.json(formula, { status: 200 });
  } catch (error) {
    return fromErrorToProblem(error);
  }
}
