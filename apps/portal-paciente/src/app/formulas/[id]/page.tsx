"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { PacienteGuard } from "@/components/PacienteGuard";
import { portalApi, type FormulaDetalle } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import {
  CLASE_ESTADO_FORMULA,
  CLASE_NIVEL_DISPONIBILIDAD,
  ETIQUETA_ESTADO_FORMULA,
  ETIQUETA_NIVEL_DISPONIBILIDAD,
  formatearFecha,
  formatearFechaHora,
  type EstadoFormula,
  type NivelDisponibilidad,
} from "@/lib/format";

function ContenidoDetalleFormula() {
  const params = useParams<{ id: string }>();
  const formulaId = params?.id ?? "";
  const { sesion, mostrarExito } = useApp();
  const token = sesion?.accessToken ?? "";

  const [formula, setFormula] = useState<FormulaDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [noEncontrada, setNoEncontrada] = useState(false);
  const [descargandoPdf, setDescargandoPdf] = useState(false);

  const cargarDetalle = useCallback(async () => {
    if (!token || !formulaId) return;
    setCargando(true);
    setNoEncontrada(false);
    try {
      const data = await portalApi.obtenerDetalleFormula(formulaId, {
        token,
        notifyGlobalError: false,
      });
      setFormula(data);
    } catch (err) {
      if (isApiError(err) && err.status === 404) {
        setNoEncontrada(true);
      }
      setFormula(null);
    } finally {
      setCargando(false);
    }
  }, [token, formulaId]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void cargarDetalle();
    }, 0);
    return () => window.clearTimeout(id);
  }, [cargarDetalle]);

  const sedesMatriz = useMemo(() => {
    const mapa = new Map<
      string,
      { sedeId: string; sedeCodigo: string; sedeNombre: string }
    >();
    for (const item of formula?.items ?? []) {
      for (const disp of item.disponibilidadPorSede ?? []) {
        if (disp.sedeId && !mapa.has(disp.sedeId)) {
          mapa.set(disp.sedeId, {
            sedeId: disp.sedeId,
            sedeCodigo: disp.sedeCodigo ?? "",
            sedeNombre: disp.sedeNombre ?? disp.sedeCodigo ?? "Sede",
          });
        }
      }
    }
    return Array.from(mapa.values());
  }, [formula]);

  const totalPendiente = useMemo(
    () =>
      (formula?.items ?? []).reduce(
        (acc, it) => acc + (it.cantidadPendiente ?? 0),
        0
      ),
    [formula]
  );

  const puedePedir = Boolean(formula?.vigente) && totalPendiente > 0;

  const manejarDescargarPdf = async () => {
    if (!token || !formula?.id) return;
    setDescargandoPdf(true);
    try {
      const { blob, filename } = await portalApi.descargarFormulaPdf(
        formula.id,
        formula.codigoExterno,
        { token }
      );
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      mostrarExito("PDF descargado", `Se descargó ${filename}.`);
    } catch {
      // Notificado globalmente
    } finally {
      setDescargandoPdf(false);
    }
  };

  if (cargando) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        <div className="h-56 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      </div>
    );
  }

  if (noEncontrada || !formula) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-lg font-bold text-slate-900">
          Fórmula no encontrada
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          No encontramos la fórmula solicitada en tu cuenta.
        </p>
        <Link
          href="/formulas"
          className="mt-4 inline-flex rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
        >
          Volver a mis fórmulas
        </Link>
      </div>
    );
  }

  const estado = (formula.estadoExterno ?? "EMITIDA") as EstadoFormula;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/formulas"
          className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800"
        >
          ← Volver a mis fórmulas
        </Link>
      </div>

      {/* Cabecera de fórmula */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-xl font-bold text-slate-900">
                {formula.codigoExterno}
              </h1>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${CLASE_ESTADO_FORMULA[estado]}`}
              >
                {ETIQUETA_ESTADO_FORMULA[estado]}
              </span>
            </div>
            <div className="mt-2 space-y-1 text-xs text-slate-600">
              {formula.medicoNombre && (
                <p>
                  <span className="font-semibold text-slate-800">Médico:</span>{" "}
                  {formula.medicoNombre}
                </p>
              )}
              <p>
                <span className="font-semibold text-slate-800">Emisión:</span>{" "}
                {formatearFecha(formula.fechaEmision)} ·{" "}
                <span className="font-semibold text-slate-800">
                  Vencimiento:
                </span>{" "}
                {formatearFecha(formula.fechaVencimiento)}
              </p>
              {formula.observaciones && (
                <p>
                  <span className="font-semibold text-slate-800">
                    Observaciones:
                  </span>{" "}
                  {formula.observaciones}
                </p>
              )}
              <p className="text-[11px] text-slate-400">
                Sincronizada: {formatearFechaHora(formula.sincronizadaEn)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={manejarDescargarPdf}
              disabled={descargandoPdf}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 shadow-xs transition hover:bg-slate-50 disabled:opacity-60 sm:text-sm"
            >
              {descargandoPdf ? "Descargando PDF…" : "Descargar PDF"}
            </button>

            {puedePedir ? (
              <Link
                href={`/pedidos/nuevo?formulaId=${encodeURIComponent(
                  formula.id ?? ""
                )}`}
                className="rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-800 sm:text-sm"
              >
                Pedir medicamentos
              </Link>
            ) : (
              <span
                title="Esta fórmula no está vigente o no tiene saldo pendiente."
                className="inline-flex cursor-not-allowed items-center rounded-xl bg-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-500 sm:text-sm"
              >
                No disponible para pedido
              </span>
            )}
          </div>
        </div>

        {!formula.vigente && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            Esta fórmula se encuentra en estado{" "}
            <strong>{ETIQUETA_ESTADO_FORMULA[estado]}</strong> o fuera de
            vigencia, por lo que solo es de consulta y no permite crear nuevos
            pedidos.
          </div>
        )}
        {formula.vigente && totalPendiente === 0 && (
          <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
            Todas las unidades autorizadas ya fueron dispensadas o se encuentran
            reservadas en pedidos activos.
          </div>
        )}
      </section>

      {/* Medicamentos, dosis y saldos pendientes (RF-PAC-07, RN-03) */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-slate-900">
          Medicamentos y saldo pendiente
        </h2>
        <div className="space-y-3">
          {(formula.items ?? []).map((item) => (
            <div
              key={item.id ?? item.medicamentoId}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-600">
                      {item.medicamentoCodigo}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 sm:text-base">
                      {item.medicamentoNombre}
                    </h3>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {item.principioActivo} · {item.presentacion}
                  </p>
                  {(item.dosis || item.frecuencia || item.duracionDias) && (
                    <p className="mt-1.5 text-xs text-slate-700">
                      <span className="font-semibold">Indicación:</span>{" "}
                      {[
                        item.dosis,
                        item.frecuencia,
                        item.duracionDias ? `durante ${item.duracionDias} días` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>

                <div className="rounded-xl bg-teal-50 px-3 py-1.5 text-right">
                  <p className="text-[10px] font-semibold tracking-wide text-teal-700 uppercase">
                    Pendiente
                  </p>
                  <p className="text-lg font-bold text-teal-900">
                    {item.cantidadPendiente ?? 0}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center text-xs">
                <div className="rounded-lg bg-slate-50 py-1.5">
                  <p className="text-[11px] text-slate-500">Autorizada</p>
                  <p className="font-bold text-slate-800">
                    {item.cantidadAutorizada ?? 0}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 py-1.5">
                  <p className="text-[11px] text-slate-500">Dispensada</p>
                  <p className="font-bold text-slate-800">
                    {item.cantidadDispensada ?? 0}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 py-1.5">
                  <p className="text-[11px] text-slate-500">Reservada</p>
                  <p className="font-bold text-slate-800">
                    {item.cantidadReservadaActiva ?? 0}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Matriz medicamento × sede (RF-PAC-09) */}
      {sedesMatriz.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Disponibilidad por sede
            </h2>
            <p className="text-xs text-slate-600">
              Compara en qué sede están disponibles tus medicamentos antes de
              agendar el turno.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs sm:text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-700">
                    Medicamento
                  </th>
                  {sedesMatriz.map((sede) => (
                    <th
                      key={sede.sedeId}
                      className="px-4 py-3 text-center font-semibold text-slate-700"
                    >
                      <div>{sede.sedeNombre}</div>
                      {puedePedir && (
                        <Link
                          href={`/pedidos/nuevo?formulaId=${encodeURIComponent(
                            formula.id ?? ""
                          )}&sedeId=${encodeURIComponent(sede.sedeId)}`}
                          className="mt-1 inline-block text-[11px] font-semibold text-teal-700 hover:underline"
                        >
                          Pedir aquí →
                        </Link>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(formula.items ?? []).map((item) => {
                  const nivelPorSede = new Map(
                    (item.disponibilidadPorSede ?? []).map((d) => [
                      d.sedeId ?? "",
                      (d.nivel ?? "AGOTADO") as NivelDisponibilidad,
                    ])
                  );

                  return (
                    <tr key={item.id ?? item.medicamentoId}>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {item.medicamentoNombre}
                      </td>
                      {sedesMatriz.map((sede) => {
                        const nivel = nivelPorSede.get(sede.sedeId) ?? "AGOTADO";
                        return (
                          <td
                            key={sede.sedeId}
                            className="px-4 py-3 text-center"
                          >
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${CLASE_NIVEL_DISPONIBILIDAD[nivel]}`}
                            >
                              {ETIQUETA_NIVEL_DISPONIBILIDAD[nivel]}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

export default function DetalleFormulaPage() {
  return (
    <PacienteGuard>
      <ContenidoDetalleFormula />
    </PacienteGuard>
  );
}
