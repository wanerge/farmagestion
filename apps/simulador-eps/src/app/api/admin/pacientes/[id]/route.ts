import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { problemResponse } from "@/lib/problem";
import { validarSesionOperador } from "@/lib/session";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authError = validarSesionOperador(request);
  if (authError) return authError;

  const { id } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return problemResponse({
      status: 400,
      title: "Error de validación",
      detail: "El cuerpo debe ser JSON válido.",
      code: "VALIDACION_ERROR",
    });
  }

  const tipoDocumento = String(body.tipoDocumento ?? "").trim().toUpperCase();
  const documento = String(body.documento ?? "").trim();
  const nombres = String(body.nombres ?? "").trim();
  const apellidos = String(body.apellidos ?? "").trim();
  const fechaNacimientoRaw = String(body.fechaNacimiento ?? "").trim();
  const eps = String(body.eps ?? "").trim();
  const telefono = body.telefono ? String(body.telefono).trim() : null;

  if (
    !tipoDocumento ||
    !documento ||
    !nombres ||
    !apellidos ||
    !fechaNacimientoRaw ||
    !eps
  ) {
    return problemResponse({
      status: 400,
      title: "Error de validación",
      detail: "Todos los campos obligatorios del paciente son requeridos.",
      code: "VALIDACION_ERROR",
    });
  }

  const fechaNacimiento = new Date(`${fechaNacimientoRaw}T00:00:00.000Z`);
  if (Number.isNaN(fechaNacimiento.getTime())) {
    return problemResponse({
      status: 400,
      title: "Error de validación",
      detail: "La fecha de nacimiento debe tener formato YYYY-MM-DD.",
      code: "VALIDACION_ERROR",
    });
  }

  try {
    const actualizado = await prisma.pacienteEps.update({
      where: { id },
      data: {
        tipoDocumento,
        documento,
        nombres,
        apellidos,
        fechaNacimiento,
        eps,
        telefono,
      },
    });
    return NextResponse.json({
      ...actualizado,
      fechaNacimiento: actualizado.fechaNacimiento.toISOString().slice(0, 10),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return problemResponse({
          status: 404,
          title: "Paciente no encontrado",
          detail: "No existe un paciente con el identificador indicado.",
          code: "FORMULA_NO_ENCONTRADA",
        });
      }
      if (error.code === "P2002") {
        return problemResponse({
          status: 409,
          title: "Paciente duplicado",
          detail: `Ya existe otro paciente con ${tipoDocumento} ${documento}.`,
          code: "VALIDACION_ERROR",
        });
      }
    }
    throw error;
  }
}
