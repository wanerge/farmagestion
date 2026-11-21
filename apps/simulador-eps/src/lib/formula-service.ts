import { Prisma } from "@prisma/client";
import { obtenerHoyBogotaISO } from "./formula-codigo";
import { prisma } from "./prisma";
import { DomainProblemError } from "./problem";

export type EstadoFormula =
  | "EMITIDA"
  | "PARCIALMENTE_DISPENSADA"
  | "DISPENSADA"
  | "VENCIDA"
  | "ANULADA";

export interface FormulaResponseDto {
  codigo: string;
  estado: EstadoFormula;
  fechaEmision: string;
  fechaVencimiento: string;
  observaciones: string | null;
  paciente: {
    tipoDocumento: string;
    documento: string;
    nombres: string;
    apellidos: string;
  };
  medico: {
    nombre: string;
  };
  items: Array<{
    medicamentoCodigo: string;
    medicamentoNombre: string;
    dosis: string;
    frecuencia: string;
    duracionDias: number;
    cantidadAutorizada: number;
    cantidadDispensada: number;
  }>;
}

export interface RegistrarDispensacionInput {
  pedidoRef: string;
  sedeCodigo: string;
  fecha: string;
  items: Array<{
    medicamentoCodigo: string;
    cantidad: number;
  }>;
}

const formulaInclude = {
  paciente: true,
  medico: true,
  items: {
    include: {
      medicamento: true,
    },
    orderBy: {
      medicamentoCodigo: "asc" as const,
    },
  },
} satisfies Prisma.FormulaInclude;

type FormulaConRelaciones = Prisma.FormulaGetPayload<{
  include: typeof formulaInclude;
}>;

function formatearFechaDate(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function calcularEstadoEfectivo(
  estadoPersistido: string,
  fechaVencimiento: Date,
  ahora: Date = new Date()
): EstadoFormula {
  const hoyBogota = obtenerHoyBogotaISO(ahora);
  const vencimientoISO = formatearFechaDate(fechaVencimiento);

  if (
    (estadoPersistido === "EMITIDA" ||
      estadoPersistido === "PARCIALMENTE_DISPENSADA") &&
    vencimientoISO < hoyBogota
  ) {
    return "VENCIDA";
  }

  return estadoPersistido as EstadoFormula;
}

export function mapearFormulaDto(
  formula: FormulaConRelaciones,
  ahora: Date = new Date()
): FormulaResponseDto {
  return {
    codigo: formula.codigo,
    estado: calcularEstadoEfectivo(
      formula.estado,
      formula.fechaVencimiento,
      ahora
    ),
    fechaEmision: formatearFechaDate(formula.fechaEmision),
    fechaVencimiento: formatearFechaDate(formula.fechaVencimiento),
    observaciones: formula.observaciones ?? null,
    paciente: {
      tipoDocumento: formula.paciente.tipoDocumento,
      documento: formula.paciente.documento,
      nombres: formula.paciente.nombres,
      apellidos: formula.paciente.apellidos,
    },
    medico: {
      nombre: formula.medico.nombre,
    },
    items: formula.items.map((item) => ({
      medicamentoCodigo: item.medicamentoCodigo,
      medicamentoNombre: item.medicamento.nombre,
      dosis: item.dosis,
      frecuencia: item.frecuencia,
      duracionDias: item.duracionDias,
      cantidadAutorizada: item.cantidadAutorizada,
      cantidadDispensada: item.cantidadDispensada,
    })),
  };
}

export async function consultarFormulaServicio(
  codigo: string,
  documento: string | null
): Promise<FormulaResponseDto> {
  const docLimpio = documento?.trim();
  if (!docLimpio) {
    throw new DomainProblemError({
      status: 404,
      title: "Fórmula no encontrada",
      detail: "No se encontró una fórmula que coincida con el código y documento indicados.",
      code: "FORMULA_NO_ENCONTRADA",
    });
  }

  const formula = await prisma.formula.findUnique({
    where: { codigo },
    include: formulaInclude,
  });

  if (!formula || formula.paciente.documento !== docLimpio) {
    throw new DomainProblemError({
      status: 404,
      title: "Fórmula no encontrada",
      detail: "No se encontró una fórmula que coincida con el código y documento indicados.",
      code: "FORMULA_NO_ENCONTRADA",
    });
  }

  return mapearFormulaDto(formula);
}

export async function registrarDispensacionServicio(
  codigo: string,
  idempotencyKey: string,
  input: RegistrarDispensacionInput
): Promise<{ status: 200 | 201; formula: FormulaResponseDto }> {
  const fechaDispensacion = new Date(input.fecha);
  if (Number.isNaN(fechaDispensacion.getTime())) {
    throw new DomainProblemError({
      status: 400,
      title: "Error de validación",
      detail: "El campo fecha debe ser una fecha y hora ISO-8601 válida.",
      code: "VALIDACION_ERROR",
    });
  }

  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM formula WHERE codigo = ${codigo} FOR UPDATE
    `;

    if (locked.length === 0) {
      throw new DomainProblemError({
        status: 404,
        title: "Fórmula no encontrada",
        detail: "No existe una fórmula con el código indicado.",
        code: "FORMULA_NO_ENCONTRADA",
      });
    }

    const formulaId = locked[0].id;

    const existente = await tx.dispensacion.findUnique({
      where: { idempotencyKey },
    });

    if (existente) {
      const actual = await tx.formula.findUniqueOrThrow({
        where: { id: formulaId },
        include: formulaInclude,
      });
      return { status: 200 as const, formula: mapearFormulaDto(actual) };
    }

    const formula = await tx.formula.findUniqueOrThrow({
      where: { id: formulaId },
      include: formulaInclude,
    });

    const estadoEfectivo = calcularEstadoEfectivo(
      formula.estado,
      formula.fechaVencimiento
    );

    if (
      estadoEfectivo === "VENCIDA" ||
      estadoEfectivo === "ANULADA" ||
      estadoEfectivo === "DISPENSADA"
    ) {
      throw new DomainProblemError({
        status: 409,
        title: "Fórmula no dispensable",
        detail: `La fórmula se encuentra en estado ${estadoEfectivo} y no admite dispensaciones.`,
        code: "FORMULA_NO_DISPENSABLE",
      });
    }

    // Agregar cantidades por medicamento si vinieran repetidos en la misma solicitud
    const solicitadasPorMed = new Map<string, number>();
    for (const item of input.items) {
      solicitadasPorMed.set(
        item.medicamentoCodigo,
        (solicitadasPorMed.get(item.medicamentoCodigo) ?? 0) + item.cantidad
      );
    }

    const itemsPorCodigo = new Map(
      formula.items.map((i) => [i.medicamentoCodigo, i])
    );

    for (const [medCodigo, cantidad] of solicitadasPorMed.entries()) {
      const formulaItem = itemsPorCodigo.get(medCodigo);
      if (!formulaItem) {
        throw new DomainProblemError({
          status: 422,
          title: "Medicamento no pertenece a la fórmula",
          detail: `El medicamento ${medCodigo} no hace parte de la fórmula ${codigo}.`,
          code: "MEDICAMENTO_NO_EN_FORMULA",
        });
      }

      if (formulaItem.cantidadDispensada + cantidad > formulaItem.cantidadAutorizada) {
        throw new DomainProblemError({
          status: 409,
          title: "Cantidad excede la autorizada",
          detail: `El medicamento ${medCodigo} excede la cantidad autorizada (${formulaItem.cantidadAutorizada}).`,
          code: "CANTIDAD_EXCEDE_AUTORIZADA",
        });
      }
    }

    // Aplicar todas las actualizaciones en la misma transacción (RN-EPS-06)
    await tx.dispensacion.create({
      data: {
        formulaId,
        pedidoRef: input.pedidoRef,
        sedeCodigo: input.sedeCodigo,
        idempotencyKey,
        fecha: fechaDispensacion,
        items: {
          create: Array.from(solicitadasPorMed.entries()).map(
            ([medicamentoCodigo, cantidad]) => ({
              medicamentoCodigo,
              cantidad,
            })
          ),
        },
      },
    });

    let todosCompletos = true;
    for (const item of formula.items) {
      const inc = solicitadasPorMed.get(item.medicamentoCodigo) ?? 0;
      const nuevaDispensada = item.cantidadDispensada + inc;
      if (inc > 0) {
        await tx.formulaItem.update({
          where: { id: item.id },
          data: { cantidadDispensada: nuevaDispensada },
        });
      }
      if (nuevaDispensada < item.cantidadAutorizada) {
        todosCompletos = false;
      }
    }

    const nuevoEstado: EstadoFormula = todosCompletos
      ? "DISPENSADA"
      : "PARCIALMENTE_DISPENSADA";

    const actualizada = await tx.formula.update({
      where: { id: formulaId },
      data: { estado: nuevoEstado },
      include: formulaInclude,
    });

    return { status: 201 as const, formula: mapearFormulaDto(actualizada) };
  });
}
