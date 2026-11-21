import { NextRequest, NextResponse } from "next/server";
import { calcularEstadoEfectivo } from "@/lib/formula-service";
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
      dispensaciones: {
        include: {
          items: { include: { medicamento: true } },
        },
        orderBy: { fecha: "desc" },
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

  return NextResponse.json({
    id: formula.id,
    codigo: formula.codigo,
    estado: calcularEstadoEfectivo(formula.estado, formula.fechaVencimiento),
    fechaEmision: formula.fechaEmision.toISOString().slice(0, 10),
    fechaVencimiento: formula.fechaVencimiento.toISOString().slice(0, 10),
    observaciones: formula.observaciones,
    paciente: {
      id: formula.paciente.id,
      tipoDocumento: formula.paciente.tipoDocumento,
      documento: formula.paciente.documento,
      nombres: formula.paciente.nombres,
      apellidos: formula.paciente.apellidos,
      eps: formula.paciente.eps,
    },
    medico: {
      id: formula.medico.id,
      nombre: formula.medico.nombre,
      registro: formula.medico.registro,
      especialidad: formula.medico.especialidad,
    },
    items: formula.items.map((i) => ({
      id: i.id,
      medicamentoCodigo: i.medicamentoCodigo,
      medicamentoNombre: i.medicamento.nombre,
      dosis: i.dosis,
      frecuencia: i.frecuencia,
      duracionDias: i.duracionDias,
      cantidadAutorizada: i.cantidadAutorizada,
      cantidadDispensada: i.cantidadDispensada,
      saldo: i.cantidadAutorizada - i.cantidadDispensada,
    })),
    dispensaciones: formula.dispensaciones.map((d) => ({
      id: d.id,
      pedidoRef: d.pedidoRef,
      sedeCodigo: d.sedeCodigo,
      fecha: d.fecha.toISOString(),
      items: d.items.map((di) => ({
        medicamentoCodigo: di.medicamentoCodigo,
        medicamentoNombre: di.medicamento.nombre,
        cantidad: di.cantidad,
      })),
    })),
  });
}
