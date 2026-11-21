"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { Modal } from "@/components/Modal";
import { PacienteGuard } from "@/components/PacienteGuard";
import { portalApi, type FormulaResumen } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import {
  CLASE_ESTADO_FORMULA,
  ETIQUETA_ESTADO_FORMULA,
  formatearFecha,
  type EstadoFormula,
} from "@/lib/format";

function ContenidoFormulas() {
  const router = useRouter();
  const { sesion, mostrarExito } = useApp();
  const token = sesion?.accessToken ?? "";

  const [formulas, setFormulas] = useState<FormulaResumen[]>([]);
  const [cargando, setCargando] = useState(true);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [vinculando, setVinculando] = useState(false);
  const [errorVincular, setErrorVincular] = useState<string | null>(null);

  const cargarFormulas = useCallback(async () => {
    if (!token) return;
    setCargando(true);
    try {
      const lista = await portalApi.listarFormulas({ token });
      setFormulas(lista);
    } catch {
      // Manejado globalmente
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void cargarFormulas();
    }, 0);
    return () => window.clearTimeout(id);
  }, [cargarFormulas]);

  const abrirModal = () => {
    setCodigo("");
    setErrorVincular(null);
    setModalAbierto(true);
  };

  const manejarVincular = async (e: React.FormEvent) => {
    e.preventDefault();
    const codigoLimpio = codigo.trim().toUpperCase();
    if (!codigoLimpio) return;

    setVinculando(true);
    setErrorVincular(null);
    try {
      const detalle = await portalApi.vincularFormula(
        { codigo: codigoLimpio },
        { token, notifyGlobalError: false }
      );
      setModalAbierto(false);
      mostrarExito(
        "Fórmula vinculada",
        `La fórmula ${detalle.codigoExterno ?? codigoLimpio} fue agregada a tu cuenta.`
      );
      await cargarFormulas();
      if (detalle.id) {
        router.push(`/formulas/${detalle.id}`);
      }
    } catch (err) {
      if (isApiError(err)) {
        // RN-PAC-01: mensaje genérico si no coincide o no existe
        if (err.code === "FORMULA_NO_ENCONTRADA") {
          setErrorVincular("No encontramos una fórmula con esos datos.");
        } else {
          setErrorVincular(err.mensajeUsuario);
        }
      } else {
        setErrorVincular("No fue posible vincular la fórmula en este momento.");
      }
    } finally {
      setVinculando(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
            Mis fórmulas médicas
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Consulta tus medicamentos autorizados, saldos pendientes y crea
            pedidos para recoger en sede.
          </p>
        </div>

        <button
          type="button"
          onClick={abrirModal}
          className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800"
        >
          + Vincular fórmula
        </button>
      </div>

      {cargando ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white p-4"
            />
          ))}
        </div>
      ) : formulas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-base font-semibold text-slate-900">
            Aún no tienes fórmulas vinculadas
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
            Ingresa el código de la fórmula emitida por tu EPS (por ejemplo{" "}
            <span className="font-mono font-medium">FRM-2026-000001</span>) para
            ver disponibilidad por sede y agendar tu turno.
          </p>
          <button
            type="button"
            onClick={abrirModal}
            className="mt-4 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-800"
          >
            Vincular mi primera fórmula
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {formulas.map((formula) => {
            const estado = (formula.estadoExterno ?? "EMITIDA") as EstadoFormula;
            const items = formula.items ?? [];
            const totalPendiente = items.reduce(
              (acc, it) => acc + (it.cantidadPendiente ?? 0),
              0
            );
            const puedePedir = Boolean(formula.vigente) && totalPendiente > 0;

            return (
              <article
                key={formula.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-slate-300 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-mono text-base font-bold text-slate-900">
                        {formula.codigoExterno}
                      </h2>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${CLASE_ESTADO_FORMULA[estado]}`}
                      >
                        {ETIQUETA_ESTADO_FORMULA[estado]}
                      </span>
                      {!formula.vigente && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          No disponible para pedidos
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      Emitida: {formatearFecha(formula.fechaEmision)} · Vigente
                      hasta: {formatearFecha(formula.fechaVencimiento)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/formulas/${formula.id}`}
                      className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Ver detalle
                    </Link>
                    {puedePedir && (
                      <Link
                        href={`/pedidos/nuevo?formulaId=${encodeURIComponent(
                          formula.id ?? ""
                        )}`}
                        className="rounded-xl bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-800"
                      >
                        Pedir
                      </Link>
                    )}
                  </div>
                </div>

                {items.length > 0 && (
                  <div className="mt-3.5 grid grid-cols-1 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2">
                    {items.map((item) => (
                      <div
                        key={item.id ?? item.medicamentoId}
                        className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-800">
                            {item.medicamentoNombre}
                          </p>
                          <p className="truncate text-[11px] text-slate-500">
                            {item.presentacion}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-semibold text-teal-800">
                            Pendiente: {item.cantidadPendiente ?? 0}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            de {item.cantidadAutorizada ?? 0} aut.
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Modal vincular fórmula (RF-PAC-06, RN-PAC-01, RN-PAC-02) */}
      <Modal
        abierto={modalAbierto}
        titulo="Vincular fórmula médica"
        descripcion="Ingresa el código único de la fórmula emitida a tu documento de identidad."
        onCerrar={() => setModalAbierto(false)}
      >
        <form onSubmit={manejarVincular} className="space-y-4">
          {errorVincular && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-900"
            >
              {errorVincular}
            </div>
          )}

          <div>
            <label
              htmlFor="codigo-formula"
              className="block text-xs font-semibold text-slate-700"
            >
              Código de fórmula
            </label>
            <input
              id="codigo-formula"
              type="text"
              required
              maxLength={40}
              autoFocus
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ej. FRM-2026-000001"
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono text-sm uppercase text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setModalAbierto(false)}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={vinculando || !codigo.trim()}
              className="rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {vinculando ? "Validando con EPS…" : "Vincular fórmula"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function FormulasPage() {
  return (
    <PacienteGuard>
      <ContenidoFormulas />
    </PacienteGuard>
  );
}
