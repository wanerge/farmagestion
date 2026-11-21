import { timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { problemResponse, type ProblemBody } from "./problem";

export function validarApiKey(
  request: NextRequest | Request
): NextResponse<ProblemBody> | null {
  const expected = process.env.FARMA_SERVICE_API_KEY;
  const provided = request.headers.get("x-api-key");

  if (!expected || !provided) {
    return problemResponse({
      status: 401,
      title: "No autorizado",
      detail: "La cabecera X-API-Key es obligatoria y debe ser válida.",
      code: "API_KEY_INVALIDA",
    });
  }

  const expectedBuf = Buffer.from(expected, "utf-8");
  const providedBuf = Buffer.from(provided, "utf-8");

  if (
    expectedBuf.length !== providedBuf.length ||
    !timingSafeEqual(expectedBuf, providedBuf)
  ) {
    return problemResponse({
      status: 401,
      title: "No autorizado",
      detail: "La cabecera X-API-Key es obligatoria y debe ser válida.",
      code: "API_KEY_INVALIDA",
    });
  }

  return null;
}
