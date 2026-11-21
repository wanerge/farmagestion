"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import {
  portalApi,
  type DisponibilidadMedicamento,
  type MedicamentoPublico,
} from "@/lib/api/client";
import {
  CLASE_NIVEL_DISPONIBILIDAD,
  ETIQUETA_NIVEL_DISPONIBILIDAD,
  formatearHora,
  type NivelDisponibilidad,
} from "@/lib/format";

const PAGE_SIZE = 10;

export default function InicioBuscarPage() {
  const { sesion } = useApp();

  const [consulta, setConsulta] = useState("");
  const [terminoActivo, setTerminoActivo] = useState("");
  const [page, setPage] = useState(0);
  const [medicamentos, setMedicamentos] = useState<MedicamentoPublico[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [cargando, setCargando] = useState(true);

  const [disponibilidadPorMed, setDisponibilidadPorMed] = useState<
    Record<string, DisponibilidadMedicamento>
  >({});
  const [cargandoDispId, setCargandoDispId] = useState<string | null>(null);
  const [expandidoId, setExpandidoId] = useState<string | null>(null);

  const cargarMedicamentos = useCallback(async (q: string, pagina: number) => {
    setCargando(true);
    try {
      const res = await portalApi.buscarMedicamentos({
        q: q.trim() || undefined,
        page: pagina,
        size: PAGE_SIZE,
      });
      const lista = res.content ?? [];
      setMedicamentos(lista);
      setTotalElements(res.totalElements ?? 0);

      // Si el usuario buscó un término específico y hay resultados, abrir el primero para mostrar disponibilidad de inmediato (CA-PAC-01)
      if (q.trim() && lista.length > 0 && lista[0].id) {
        const primeroId = lista[0].id;
        setExpandidoId(primeroId);
        setCargandoDispId(primeroId);
        try {
          const disp = await portalApi.consultarDisponibilidadMedicamento(primeroId);
          setDisponibilidadPorMed((prev) => ({ ...prev, [primeroId]: disp }));
        } catch {
          // El error global ya notifica si falla
        } finally {
          setCargandoDispId((curr) => (curr === primeroId ? null : curr));
        }
      }
    } catch {
      setMedicamentos([]);
      setTotalElements(0);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void cargarMedicamentos(terminoActivo, page);
    }, 0);
    return () => window.clearTimeout(id);
  }, [terminoActivo, page, cargarMedicamentos]);

  const manejarBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    setTerminoActivo(consulta.trim());
  };

  const limpiarBusqueda = () => {
    setConsulta("");
    setTerminoActivo("");
    setPage(0);
    setExpandidoId(null);
  };

  const alternarDisponibilidad = async (medId: string) => {
    if (expandidoId === medId) {
      setExpandidoId(null);
      return;
    }
    setExpandidoId(medId);
    if (disponibilidadPorMed[medId]) {
      return;
    }
    setCargandoDispId(medId);
    try {
      const disp = await portalApi.consultarDisponibilidadMedicamento(medId);
      setDisponibilidadPorMed((prev) => ({ ...prev, [medId]: disp }));
    } catch {
      // Manejado globalmente
    } finally {
      setCargandoDispId((curr) => (curr === medId ? null : curr));
    }
  };

  const totalPaginas = Math.max(1, Math.ceil(totalElements / PAGE_SIZE));

  return (
    <div className="space-y-6">
      {/* Encabezado y buscador público (RF-PAC-04) */}
      <section className="rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-700 to-teal-800 p-5 text-white shadow-sm sm:p-7">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-wider text-teal-100 uppercase">
            Consulta pública sin filas
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Verifica disponibilidad antes de desplazarte
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-teal-50">
            Busca cualquier medicamento por nombre o principio activo para ver si
            está disponible, con pocas unidades o agotado en cada sede.
          </p>
        </div>

        <form onSubmit={manejarBuscar} className="mt-5 flex flex-col gap-2.5 sm:flex-row">
          <label htmlFor="buscador-medicamentos" className="sr-only">
            Buscar medicamento
          </label>
          <div className="relative flex-1">
            <input
              id="buscador-medicamentos"
              type="search"
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              placeholder="Ej. Losartán, Metformina, Acetaminofén…"
              className="w-full rounded-xl border border-teal-500/40 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-white focus:outline-none focus:ring-2 focus:ring-teal-200"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 sm:flex-none"
            >
              Buscar
            </button>
            {terminoActivo && (
              <button
                type="button"
                onClick={limpiarBusqueda}
                className="rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-sm font-medium text-white hover:bg-white/20"
              >
                Limpiar
              </button>
            )}
          </div>
        </form>

        {/* Sugerencias rápidas */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-teal-100">Búsquedas frecuentes:</span>
          {["Losartán", "Metformina", "Omeprazol", "Atorvastatina"].map((ej) => (
            <button
              key={ej}
              type="button"
              onClick={() => {
                setConsulta(ej);
                setPage(0);
                setTerminoActivo(ej);
              }}
              className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1 font-medium text-white transition hover:bg-white/20"
            >
              {ej}
            </button>
          ))}
        </div>
      </section>

      {/* Accesos rápidos contextuales */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href="/sedes"
          className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-teal-300 hover:shadow-sm"
        >
          <div>
            <p className="text-sm font-bold text-slate-900">Ver sedes y mapa</p>
            <p className="mt-0.5 text-xs text-slate-600">
              Consulta direcciones, horarios de atención y ubicación en el mapa.
            </p>
          </div>
          <span className="ml-3 rounded-xl bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800">
            Abrir mapa →
          </span>
        </Link>

        {sesion ? (
          <Link
            href="/formulas"
            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-teal-300 hover:shadow-sm"
          >
            <div>
              <p className="text-sm font-bold text-slate-900">
                Mis fórmulas y pedidos
              </p>
              <p className="mt-0.5 text-xs text-slate-600">
                Vincula una fórmula médica, descarga el PDF y reserva turno en sede.
              </p>
            </div>
            <span className="ml-3 rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white">
              Ir a fórmulas →
            </span>
          </Link>
        ) : (
          <Link
            href="/login"
            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-teal-300 hover:shadow-sm"
          >
            <div>
              <p className="text-sm font-bold text-slate-900">
                ¿Tienes una fórmula médica?
              </p>
              <p className="mt-0.5 text-xs text-slate-600">
                Inicia sesión o regístrate para reservar medicamentos y pedir turno.
              </p>
            </div>
            <span className="ml-3 rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white">
              Ingresar →
            </span>
          </Link>
        )}
      </section>

      {/* Resultados del catálogo */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900 sm:text-lg">
            {terminoActivo
              ? `Resultados para "${terminoActivo}"`
              : "Catálogo de medicamentos"}
          </h2>
          <p className="text-xs text-slate-500">
            {cargando
              ? "Consultando catálogo…"
              : `${totalElements} medicamento${totalElements === 1 ? "" : "s"}`}
          </p>
        </div>

        {/* Leyenda de niveles (RN-10) */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-600">
          <span className="font-medium text-slate-700">Niveles:</span>
          {(["DISPONIBLE", "POCAS_UNIDADES", "AGOTADO"] as NivelDisponibilidad[]).map(
            (nivel) => (
              <span
                key={nivel}
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${CLASE_NIVEL_DISPONIBILIDAD[nivel]}`}
              >
                {ETIQUETA_NIVEL_DISPONIBILIDAD[nivel]}
              </span>
            )
          )}
          <span className="text-[11px] text-slate-500">
            (Disponibilidad orientativa por sede; no se muestran cantidades exactas.)
          </span>
        </div>

        {cargando ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white p-4"
              />
            ))}
          </div>
        ) : medicamentos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No encontramos medicamentos con ese criterio.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Intenta buscar por principio activo o revisa la ortografía del nombre.
            </p>
            {terminoActivo && (
              <button
                type="button"
                onClick={limpiarBusqueda}
                className="mt-4 rounded-xl bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
              >
                Ver todo el catálogo
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {medicamentos.map((med) => {
              const medId = med.id ?? "";
              const abierto = expandidoId === medId;
              const disp = disponibilidadPorMed[medId];
              const cargandoEsta = cargandoDispId === medId;

              return (
                <article
                  key={medId || med.codigo}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs transition hover:border-slate-300"
                >
                  <button
                    type="button"
                    onClick={() => medId && void alternarDisponibilidad(medId)}
                    aria-expanded={abierto}
                    className="flex w-full items-start justify-between gap-4 p-4 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-600">
                          {med.codigo}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 sm:text-base">
                          {med.nombre}
                        </h3>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        <span className="font-medium">Principio activo:</span>{" "}
                        {med.principioActivo} · {med.presentacion}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                        abierto
                          ? "bg-teal-50 text-teal-800"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {abierto ? "Ocultar sedes ▲" : "Ver sedes ▼"}
                    </span>
                  </button>

                  {abierto && (
                    <div className="border-t border-slate-100 bg-slate-50/70 p-4">
                      {cargandoEsta ? (
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
                          <span>Consultando disponibilidad por sede…</span>
                        </div>
                      ) : disp?.sedes && disp.sedes.length > 0 ? (
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                          {disp.sedes.map((sede) => {
                            const nivel = (sede.nivel ?? "AGOTADO") as NivelDisponibilidad;
                            return (
                              <div
                                key={sede.sedeId ?? sede.codigo}
                                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3"
                              >
                                <div>
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-sm font-bold text-slate-900">
                                      {sede.nombre}
                                    </p>
                                    <span
                                      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${CLASE_NIVEL_DISPONIBILIDAD[nivel]}`}
                                    >
                                      {ETIQUETA_NIVEL_DISPONIBILIDAD[nivel]}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs text-slate-600">
                                    {sede.direccion}
                                  </p>
                                  <p className="mt-1 text-[11px] text-slate-500">
                                    Horario: {formatearHora(sede.horaApertura)} –{" "}
                                    {formatearHora(sede.horaCierre)}
                                  </p>
                                </div>
                                <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2">
                                  <Link
                                    href={`/sedes?sede=${encodeURIComponent(
                                      sede.codigo ?? ""
                                    )}`}
                                    className="text-xs font-semibold text-teal-700 hover:text-teal-800"
                                  >
                                    Ver en mapa
                                  </Link>
                                  {sesion && nivel !== "AGOTADO" && (
                                    <Link
                                      href="/formulas"
                                      className="text-xs font-medium text-slate-600 hover:text-slate-900"
                                    >
                                      Pedir con fórmula →
                                    </Link>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">
                          No hay información de disponibilidad registrada para este medicamento.
                        </p>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {/* Paginación */}
        {!cargando && totalPaginas > 1 && (
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              disabled={page <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Anterior
            </button>
            <span className="text-xs font-medium text-slate-600">
              Página {page + 1} de {totalPaginas}
            </span>
            <button
              type="button"
              disabled={page + 1 >= totalPaginas}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Siguiente →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
