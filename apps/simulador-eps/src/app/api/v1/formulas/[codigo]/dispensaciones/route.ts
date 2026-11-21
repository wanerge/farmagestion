import { NextRequest, NextResponse } from "next/server";
import { validarApiKey } from "@/lib/api-key";
import {
  registrarDispensacionServicio,
  type RegistrarDispensacionInput,
} from "@/lib/formula-service";
import { fromErrorToProblem, problemResponse } from "@/lib/problem";

function validarPayload(body: unknown): RegistrarDispensacionInput | null {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;

  if (
    typeof data.pedidoRef !== "string" ||
    data.pedidoRef.trim().length === 0 ||
    data.pedidoRef.length > 60
  ) {
    return null;
  }

  if (
    typeof data.sedeCodigo !== "string" ||
    data.sedeCodigo.trim().length === 0 ||
    data.sedeCodigo.length > 32
  ) {
    return null;
  }

  if (typeof data.fecha !== "string" || data.fecha.trim().length === 0) {
    return null;
  }

  if (!Array.isArray(data.items) || data.items.length === 0) {
    return null;
  }

  const items: Array<{ medicamentoCodigo: string; cantidad: number }> = [];
  for (const item of data.items) {
    if (!item || typeof item !== "object") return null;
    const raw = item as Record<string, unknown>;
    if (
      typeof raw.medicamentoCodigo !== "string" ||
      raw.medicamentoCodigo.trim().length === 0
    ) {
      return null;
    }
    if (
      typeof raw.cantidad !== "number" ||
      !Number.isInteger(raw.cantidad) ||
      raw.cantidad < 1
    ) {
      return null;
    }
    items.push({
      medicamentoCodigo: raw.medicamentoCodigo.trim(),
      cantidad: raw.cantidad,
    });
  }

  return {
    pedidoRef: data.pedidoRef.trim(),
    sedeCodigo: data.sedeCodigo.trim(),
    fecha: data.fecha.trim(),
    items,
  };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ codigo: string }> }
) {
  const authError = validarApiKey(request);
  if (authError) return authError;

  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length > 120) {
    return problemResponse({
      status: 400,
      title: "Error de validación",
      detail: "La cabecera Idempotency-Key es obligatoria (máximo 120 caracteres).",
      code: "VALIDACION_ERROR",
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return problemResponse({
      status: 400,
      title: "Error de validación",
      detail: "El cuerpo de la solicitud debe ser JSON válido.",
      code: "VALIDACION_ERROR",
    });
  }

  const payload = validarPayload(body);
  if (!payload) {
    return problemResponse({
      status: 400,
      title: "Error de validación",
      detail:
        "El cuerpo debe incluir pedidoRef, sedeCodigo, fecha e items con medicamentoCodigo y cantidad entera positiva.",
      code: "VALIDACION_ERROR",
    });
  }

  try {
    const { codigo } = await context.params;
    const result = await registrarDispensacionServicio(
      codigo,
      idempotencyKey,
      payload
    );
    return NextResponse.json(result.formula, { status: result.status });
  } catch (error) {
    return fromErrorToProblem(error);
  }
}
