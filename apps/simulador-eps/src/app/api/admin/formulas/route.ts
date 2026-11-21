import { NextRequest, NextResponse } from "next/server";
import {
  generarCodigoFormula,
  obtenerHoyBogotaISO,
} from "@/lib/formula-codigo";
import { calcularEstadoEfectivo } from "@/lib/formula-service";
import { prisma } from "@/lib/prisma";
import { problemResponse } from "@/lib/problem";
import { validarSesionOperador } from "@/lib/session";

export async function GET(request: NextRequest) {
  const authError = validarSesionOperador(request);
  if (authError) return authError;

  const sp = request.nextUrl.searchParams;
  const estadoFiltro = sp.get("estado")?.trim();
  const pacienteId = sp.get("pacienteId")?.trim();
  const desde = sp.get("desde")?.trim();
  const hasta = sp.get("hasta")?.trim();

  const where: Record<string, unknown> = {};
  if (pacienteId) where.pacienteId = pacienteId;
  if (desde || hasta) {
    const fechaEmision: Record<string, Date> = {};
    if (desde) fechaEmision.gte = new Date(`${desde}T00:00:00.000Z`);
    if (hasta) fechaEmision.lte = new Date(`${hasta}T00:00:00.000Z`);
    where.fechaEmision = fechaEmision;
  }

  const formulas = await prisma.formula.findMany({
    where,
    include: {
      paciente: true,
      medico: true,
      items: { include: { medicamento: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const mapeadas = formulas
    .map((f) => {
      const estadoEfectivo = calcularEstadoEfectivo(
        f.estado,
        f.fechaVencimiento
      );
      return {
        id: f.id,
        codigo: f.codigo,
        estado: estadoEfectivo,
        fechaEmision: f.fechaEmision.toISOString().slice(0, 10),
        fechaVencimiento: f.fechaVencimiento.toISOString().slice(0, 10),
        observaciones: f.observaciones,
        paciente: {
          id: f.paciente.id,
          tipoDocumento: f.paciente.tipoDocumento,
          documento: f.paciente.documento,
          nombres: f.paciente.nombres,
          apellidos: f.paciente.apellidos,
        },
        medico: {
          id: f.medico.id,
          nombre: f.medico.nombre,
          especialidad: f.medico.especialidad,
        },
        totalItems: f.items.length,
      };
    })
    .filter((f) => (!estadoFiltro ? true : f.estado === estadoFiltro));

  return NextResponse.json({ items: mapeadas });
}

interface EmitirItemInput {
  medicamentoCodigo: string;
  dosis: string;
  frecuencia: string;
  duracionDias: number;
  cantidadAutorizada: number;
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

  const pacienteId = String(body.pacienteId ?? "").trim();
  const medicoId = String(body.medicoId ?? "").trim();
  const vigenciaDias =
    body.vigenciaDias === undefined || body.vigenciaDias === null
      ? 30
      : Number(body.vigenciaDias);
  const observaciones = body.observaciones
    ? String(body.observaciones).trim()
    : null;
  const rawItems = Array.isArray(body.items) ? body.items : [];

  if (!pacienteId || !medicoId) {
    return problemResponse({
      status: 400,
      title: "Error de validación",
      detail: "Debe seleccionar un paciente y un médico.",
      code: "VALIDACION_ERROR",
    });
  }

  if (!Number.isInteger(vigenciaDias) || vigenciaDias < 1 || vigenciaDias > 365) {
    return problemResponse({
      status: 400,
      title: "Error de validación",
      detail: "La vigencia debe ser un número entero entre 1 y 365 días.",
      code: "VALIDACION_ERROR",
    });
  }

  if (rawItems.length < 1 || rawItems.length > 10) {
    return problemResponse({
      status: 400,
      title: "Error de validación",
      detail: "Una fórmula debe tener entre 1 y 10 ítems (RF-EPS-03).",
      code: "VALIDACION_ERROR",
    });
  }

  const items: EmitirItemInput[] = [];
  const codigosVistos = new Set<string>();

  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") {
      return problemResponse({
        status: 400,
        title: "Error de validación",
        detail: "Formato de ítem inválido.",
        code: "VALIDACION_ERROR",
      });
    }
    const r = raw as Record<string, unknown>;
    const medicamentoCodigo = String(r.medicamentoCodigo ?? "").trim();
    const dosis = String(r.dosis ?? "").trim();
    const frecuencia = String(r.frecuencia ?? "").trim();
    const duracionDias = Number(r.duracionDias);
    const cantidadAutorizada = Number(r.cantidadAutorizada);

    if (
      !medicamentoCodigo ||
      !dosis ||
      !frecuencia ||
      !Number.isInteger(duracionDias) ||
      duracionDias < 1 ||
      !Number.isInteger(cantidadAutorizada) ||
      cantidadAutorizada < 1
    ) {
      return problemResponse({
        status: 400,
        title: "Error de validación",
        detail:
          "Cada ítem debe incluir medicamentoCodigo, dosis, frecuencia, duracionDias (>=1) y cantidadAutorizada (>=1).",
        code: "VALIDACION_ERROR",
      });
    }

    if (codigosVistos.has(medicamentoCodigo)) {
      return problemResponse({
        status: 400,
        title: "Medicamento repetido",
        detail: `El medicamento ${medicamentoCodigo} está duplicado en la fórmula (RN-EPS-02).`,
        code: "VALIDACION_ERROR",
      });
    }
    codigosVistos.add(medicamentoCodigo);

    items.push({
      medicamentoCodigo,
      dosis,
      frecuencia,
      duracionDias,
      cantidadAutorizada,
    });
  }

  const [paciente, medico, meds] = await Promise.all([
    prisma.pacienteEps.findUnique({ where: { id: pacienteId } }),
    prisma.medico.findUnique({ where: { id: medicoId } }),
    prisma.medicamentoCatalogo.findMany({
      where: { codigo: { in: Array.from(codigosVistos) } },
    }),
  ]);

  if (!paciente || !medico) {
    return problemResponse({
      status: 404,
      title: "Entidad no encontrada",
      detail: "El paciente o el médico indicado no existe.",
      code: "FORMULA_NO_ENCONTRADA",
    });
  }

  if (meds.length !== codigosVistos.size) {
    return problemResponse({
      status: 400,
      title: "Medicamento inválido",
      detail: "Alguno de los medicamentos indicados no existe en el catálogo.",
      code: "VALIDACION_ERROR",
    });
  }

  const hoyIso = obtenerHoyBogotaISO();
  const fechaEmision = new Date(`${hoyIso}T00:00:00.000Z`);
  const fechaVencimiento = new Date(fechaEmision);
  fechaVencimiento.setUTCDate(fechaVencimiento.getUTCDate() + vigenciaDias);

  const creada = await prisma.$transaction(async (tx) => {
    const codigo = await generarCodigoFormula(tx);
    return tx.formula.create({
      data: {
        codigo,
        pacienteId,
        medicoId,
        fechaEmision,
        fechaVencimiento,
        estado: "EMITIDA",
        observaciones,
        items: {
          create: items.map((i) => ({
            ...i,
            cantidadDispensada: 0,
          })),
        },
      },
      include: {
        paciente: true,
        medico: true,
        items: { include: { medicamento: true } },
      },
    });
  });

  return NextResponse.json(
    {
      id: creada.id,
      codigo: creada.codigo,
      estado: creada.estado,
      fechaEmision: creada.fechaEmision.toISOString().slice(0, 10),
      fechaVencimiento: creada.fechaVencimiento.toISOString().slice(0, 10),
      observaciones: creada.observaciones,
      paciente: {
        id: creada.paciente.id,
        tipoDocumento: creada.paciente.tipoDocumento,
        documento: creada.paciente.documento,
        nombres: creada.paciente.nombres,
        apellidos: creada.paciente.apellidos,
      },
      medico: {
        id: creada.medico.id,
        nombre: creada.medico.nombre,
      },
      items: creada.items.map((i) => ({
        medicamentoCodigo: i.medicamentoCodigo,
        medicamentoNombre: i.medicamento.nombre,
        dosis: i.dosis,
        frecuencia: i.frecuencia,
        duracionDias: i.duracionDias,
        cantidadAutorizada: i.cantidadAutorizada,
        cantidadDispensada: i.cantidadDispensada,
      })),
    },
    { status: 201 }
  );
}
