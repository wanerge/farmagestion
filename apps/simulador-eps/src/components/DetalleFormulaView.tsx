"use client";

import { useCallback, useEffect, useState } from "react";
import { badgeEstado } from "./FormulasView";

interface FormulaDetalle {
  id: string;
  codigo: string;
  estado: string;
  fechaEmision: string;
  fechaVencimiento: string;
  observaciones: string | null;
  paciente: {
    tipoDocumento: string;
    documento: string;
    nombres: string;
    apellidos: string;
    eps: string;
  };
  medico: {
    nombre: string;
    registro: string;
    especialidad: string;
  };
  items: Array<{
    id: string;
    medicamentoCodigo: string;
    medicamentoNombre: string;
    dosis: string;
    frecuencia: string;
    duracionDias: number;
    cantidadAutorizada: number;
    cantidadDispensada: number;
    saldo: number;
  }>;
  dispensaciones: Array<{
    id: string;
    pedidoRef: string;
    sedeCodigo: string;
    fecha: string;
    items: Array<{
      medicamentoCodigo: string;
      medicamentoNombre: string;
      cantidad: number;
    }>;
  }>;
}

export function DetalleFormulaView({
  formulaId,
  onVolver,
}: {
  formulaId: string;
  onVolver: () => void;
}) {
  const [detalle, setDetalle] = useState<FormulaDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anulando, setAnulando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/formulas/${formulaId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "No se pudo cargar la fórmula.");
      setDetalle(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando detalle.");
    } finally {
      setCargando(false);
    }
  }, [formulaId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function anular() {
    if (!detalle) return;
    const confirmado = window.confirm(
      `¿Seguro que deseas anular la fórmula ${detalle.codigo}? Esta acción no se puede deshacer.`
    );
    if (!confirmado) return;

    setAnulando(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/formulas/${detalle.id}/anular`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "No se pudo anular.");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al anular.");
    } finally {
      setAnulando(false);
    }
  }

  if (cargando) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Cargando detalle de fórmula...
      </div>
    );
  }

  if (!detalle) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error ?? "Fórmula no encontrada."}
      </div>
    );
  }

  const puedeAnular =
    detalle.estado === "EMITIDA" && detalle.dispensaciones.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onVolver}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          ← Volver al listado
        </button>

        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/admin/formulas/${detalle.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Descargar PDF
          </a>
          {puedeAnular && (
            <button
              type="button"
              disabled={anulando}
              onClick={anular}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {anulando ? "Anulando..." : "Anular fórmula"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Código de fórmula
            </p>
            <h2 className="mt-0.5 font-mono text-2xl font-bold text-slate-900">
              {detalle.codigo}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Emisión: {detalle.fechaEmision} · Vigencia hasta:{" "}
              {detalle.fechaVencimiento}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeEstado(
              detalle.estado
            )}`}
          >
            {detalle.estado}
          </span>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-4">
            <h3 className="text-xs font-semibold uppercase text-slate-500">
              Paciente
            </h3>
            <p className="mt-1 font-medium text-slate-900">
              {detalle.paciente.nombres} {detalle.paciente.apellidos}
            </p>
            <p className="text-xs text-slate-600">
              {detalle.paciente.tipoDocumento} {detalle.paciente.documento} ·{" "}
              {detalle.paciente.eps}
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-4">
            <h3 className="text-xs font-semibold uppercase text-slate-500">
              Médico prescriptor
            </h3>
            <p className="mt-1 font-medium text-slate-900">
              {detalle.medico.nombre}
            </p>
            <p className="text-xs text-slate-600">
              {detalle.medico.especialidad} · Reg. {detalle.medico.registro}
            </p>
          </div>
        </div>

        {detalle.observaciones && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <span className="font-semibold">Observaciones:</span>{" "}
            {detalle.observaciones}
          </div>
        )}

        <h3 className="mt-6 text-sm font-semibold text-slate-900">
          Medicamentos y saldos
        </h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-3">Código</th>
                <th className="py-2 pr-3">Medicamento</th>
                <th className="py-2 pr-3">Posología</th>
                <th className="py-2 pr-3 text-right">Autorizada</th>
                <th className="py-2 pr-3 text-right">Dispensada</th>
                <th className="py-2 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {detalle.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-2.5 pr-3 font-mono text-xs">
                    {item.medicamentoCodigo}
                  </td>
                  <td className="py-2.5 pr-3 font-medium text-slate-900">
                    {item.medicamentoNombre}
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-slate-600">
                    {item.dosis} · {item.frecuencia} · {item.duracionDias} días
                  </td>
                  <td className="py-2.5 pr-3 text-right">
                    {item.cantidadAutorizada}
                  </td>
                  <td className="py-2.5 pr-3 text-right">
                    {item.cantidadDispensada}
                  </td>
                  <td className="py-2.5 text-right font-semibold text-slate-900">
                    {item.saldo}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">
          Historial de dispensaciones ({detalle.dispensaciones.length})
        </h3>
        {detalle.dispensaciones.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Aún no se han registrado dispensaciones para esta fórmula.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {detalle.dispensaciones.map((d) => (
              <div
                key={d.id}
                className="rounded-lg border border-slate-200 p-4 text-sm"
              >
                <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                  <span>
                    Pedido: <strong className="font-mono text-slate-800">{d.pedidoRef}</strong>
                  </span>
                  <span>
                    Sede: <strong className="text-slate-800">{d.sedeCodigo}</strong>
                  </span>
                  <span>{new Date(d.fecha).toLocaleString("es-CO")}</span>
                </div>
                <ul className="mt-2 list-disc pl-5 text-xs text-slate-700">
                  {d.items.map((di) => (
                    <li key={di.medicamentoCodigo}>
                      {di.medicamentoCodigo} — {di.medicamentoNombre}:{" "}
                      <strong>{di.cantidad}</strong> unidades
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
