import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { problemResponse } from "@/lib/problem";
import { validarSesionOperador } from "@/lib/session";

export async function GET(request: NextRequest) {
  const authError = validarSesionOperador(request);
  if (authError) return authError;

  const q = request.nextUrl.searchParams.get("q")?.trim();

  const pacientes = await prisma.pacienteEps.findMany({
    where: q
      ? {
          OR: [
            { documento: { contains: q, mode: "insensitive" } },
            { nombres: { contains: q, mode: "insensitive" } },
            { apellidos: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    items: pacientes.map((p) => ({
      ...p,
      fechaNacimiento: p.fechaNacimiento.toISOString().slice(0, 10),
    })),
  });
}

export async function POST(request: NextRequest) {
  const authError = validarSesionOperador(request);
  if (authError) return authError;

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
      detail:
        "Todos los campos obligatorios (tipoDocumento, documento, nombres, apellidos, fechaNacimiento, eps) son requeridos.",
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
    const creado = await prisma.pacienteEps.create({
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
    return NextResponse.json(
      {
        ...creado,
        fechaNacimiento: creado.fechaNacimiento.toISOString().slice(0, 10),
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return problemResponse({
        status: 409,
        title: "Paciente duplicado",
        detail: `Ya existe un paciente registrado con ${tipoDocumento} ${documento}.`,
        code: "VALIDACION_ERROR",
      });
    }
    throw error;
  }
}
