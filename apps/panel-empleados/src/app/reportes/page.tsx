"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useApp } from "@/components/AppProvider";
import { RoleGuard } from "@/components/RoleGuard";
import {
  farmaApi,
  type ReporteFaltantes,
  type ReportePedidos,
  type ReporteTiempos,
  type ReporteTurnos,
} from "@/lib/api/client";
import { esAdmin, puedeVerReportes } from "@/lib/auth/permisos";
import { descargarCsv } from "@/lib/csv";
import {
  ETIQUETA_ESTADO_PEDIDO,
  ETIQUETA_MODALIDAD,
  fechaHaceDiasBogota,
  fechaHoyBogota,
  formatearMinutos,
} from "@/lib/format";

type TabReporte = "pedidos" | "tiempos" | "turnos" | "faltantes";

const TABS: Array<{ id: TabReporte; label: string; descripcion: string }> = [
  {
    id: "pedidos",
    label: "Pedidos",
    descripcion: "Pedidos por estado y evolución diaria",
  },
  {
    id: "tiempos",
    label: "Tiempos",
    descripcion: "Promedio de preparación (RESERVADO → LISTO) y entrega (LISTO → ENTREGADO)",
  },
  {
    id: "turnos",
    label: "Turnos",
    descripcion: "Turnos atendidos y distribución por franja horaria",
  },
  {
    id: "faltantes",
    label: "Faltantes",
    descripcion: "Ranking de medicamentos agotados o con más faltantes",
  },
];

function ContenidoReportes() {
  const { sesion, sedeSeleccionadaId, sedeActiva, mostrarExito } = useApp();
  const token = sesion?.accessToken;
  const admin = esAdmin(sesion?.usuario);

  const [tab, setTab] = useState<TabReporte>("tiempos");
  const [desde, setDesde] = useState<string>(() => fechaHaceDiasBogota(29));
  const [hasta, setHasta] = useState<string>(() => fechaHoyBogota());
  const [cargando, setCargando] = useState<boolean>(true);
  const [errorRango, setErrorRango] = useState<string | null>(null);

  const [repPedidos, setRepPedidos] = useState<ReportePedidos | null>(null);
  const [repTiempos, setRepTiempos] = useState<ReporteTiempos | null>(null);
  const [repTurnos, setRepTurnos] = useState<ReporteTurnos | null>(null);
  const [repFaltantes, setRepFaltantes] = useState<ReporteFaltantes | null>(null);

  const cargarReportes = useCallback(async () => {
    if (!token) return;
    if (desde && hasta && desde > hasta) {
      setErrorRango("La fecha inicial no puede ser posterior a la fecha final.");
      return;
    }
    setErrorRango(null);
    setCargando(true);
    try {
      const query = {
        sedeId: admin ? sedeSeleccionadaId || undefined : undefined,
        desde: desde || undefined,
        hasta: hasta || undefined,
      };
      const [pedidos, tiempos, turnos, faltantes] = await Promise.all([
        farmaApi.obtenerReportePedidos(query, { token }),
        farmaApi.obtenerReporteTiempos(query, { token }),
        farmaApi.obtenerReporteTurnos(query, { token }),
        farmaApi.obtenerReporteFaltantes(query, { token }),
      ]);
      setRepPedidos(pedidos);
      setRepTiempos(tiempos);
      setRepTurnos(turnos);
      setRepFaltantes(faltantes);
    } catch {
      // El gestor global muestra el error problem+json
    } finally {
      setCargando(false);
    }
  }, [token, admin, sedeSeleccionadaId, desde, hasta]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void cargarReportes();
    }, 0);
    return () => window.clearTimeout(id);
  }, [cargarReportes]);

  const aplicarRangoRapido = (diasAtras: number) => {
    setDesde(fechaHaceDiasBogota(diasAtras));
    setHasta(fechaHoyBogota());
  };

  const datosPedidosEstado = useMemo(() => {
    return (repPedidos?.porEstado ?? []).map((item) => ({
      estado: item.estado ? ETIQUETA_ESTADO_PEDIDO[item.estado] : "—",
      cantidad: item.cantidad ?? 0,
    }));
  }, [repPedidos]);

  const datosPedidosDia = useMemo(() => {
    return (repPedidos?.porDia ?? []).map((item) => ({
      fecha: item.fecha ?? "",
      total: item.total ?? 0,
      entregados: item.entregados ?? 0,
      cancelados: item.cancelados ?? 0,
      vencidos: item.vencidos ?? 0,
    }));
  }, [repPedidos]);

  const datosTiemposDia = useMemo(() => {
    return (repTiempos?.porDia ?? []).map((item) => ({
      fecha: item.fecha ?? "",
      cantidadEntregados: item.cantidadEntregados ?? 0,
      preparacion: item.promedioPreparacionMin ?? 0,
      entrega: item.promedioEntregaMin ?? 0,
      total: item.promedioTotalMin ?? 0,
    }));
  }, [repTiempos]);

  const datosTiemposModalidad = useMemo(() => {
    return (repTiempos?.porModalidad ?? []).map((item) => ({
      modalidad: item.modalidad ? ETIQUETA_MODALIDAD[item.modalidad] : "—",
      cantidadEntregados: item.cantidadEntregados ?? 0,
      preparacion: item.promedioPreparacionMin ?? 0,
      entrega: item.promedioEntregaMin ?? 0,
    }));
  }, [repTiempos]);

  const datosTurnosFranja = useMemo(() => {
    return (repTurnos?.porFranja ?? []).map((item) => ({
      franja: item.franjaInicio ?? "",
      total: item.total ?? 0,
      atendidos: item.atendidos ?? 0,
      pendientes: (item.enEspera ?? 0) + (item.llamados ?? 0),
      vencidos: item.vencidos ?? 0,
      cancelados: item.cancelados ?? 0,
    }));
  }, [repTurnos]);

  const datosFaltantesGrafico = useMemo(() => {
    return (repFaltantes?.items ?? []).slice(0, 10).map((item) => ({
      medicamento: item.medicamentoNombre ?? item.medicamentoCodigo ?? "—",
      unidadesFaltantes: item.unidadesFaltantes ?? 0,
      vecesFaltante: item.vecesFaltante ?? 0,
      sedesAgotado: item.sedesAgotado ?? 0,
    }));
  }, [repFaltantes]);

  const exportarTablaActivaCsv = () => {
    const sufijoSede = sedeActiva?.codigo?.toLowerCase() ?? "todas-sedes";
    const sufijo = `${sufijoSede}_${desde}_a_${hasta}`;

    if (tab === "pedidos") {
      const filas = (repPedidos?.porDia ?? []).map((item) => [
        item.fecha ?? "",
        item.total ?? 0,
        item.entregados ?? 0,
        item.cancelados ?? 0,
        item.vencidos ?? 0,
      ]);
      descargarCsv(
        `reporte-pedidos-${sufijo}.csv`,
        ["Fecha", "Total pedidos", "Entregados", "Cancelados", "Vencidos"],
        filas
      );
      mostrarExito("CSV exportado", "Se descargó el reporte de pedidos por día.");
      return;
    }

    if (tab === "tiempos") {
      const filas = (repTiempos?.porDia ?? []).map((item) => [
        item.fecha ?? "",
        item.cantidadEntregados ?? 0,
        item.promedioPreparacionMin ?? 0,
        item.promedioEntregaMin ?? 0,
        item.promedioTotalMin ?? 0,
      ]);
      descargarCsv(
        `reporte-tiempos-${sufijo}.csv`,
        [
          "Fecha",
          "Pedidos entregados",
          "Promedio preparación (min)",
          "Promedio entrega (min)",
          "Promedio total (min)",
        ],
        filas
      );
      mostrarExito("CSV exportado", "Se descargó el reporte de tiempos de preparación y entrega.");
      return;
    }

    if (tab === "turnos") {
      const filas = (repTurnos?.porFranja ?? []).map((item) => [
        item.franjaInicio ?? "",
        item.total ?? 0,
        item.atendidos ?? 0,
        item.enEspera ?? 0,
        item.llamados ?? 0,
        item.vencidos ?? 0,
        item.cancelados ?? 0,
      ]);
      descargarCsv(
        `reporte-turnos-${sufijo}.csv`,
        ["Franja", "Total", "Atendidos", "En espera", "Llamados", "Vencidos", "Cancelados"],
        filas
      );
      mostrarExito("CSV exportado", "Se descargó el reporte de turnos por franja.");
      return;
    }

    const filas = (repFaltantes?.items ?? []).map((item) => [
      item.medicamentoCodigo ?? "",
      item.medicamentoNombre ?? "",
      item.vecesFaltante ?? 0,
      item.vecesAgotado ?? 0,
      item.unidadesFaltantes ?? 0,
      item.sedesAgotado ?? 0,
      item.sedesBajoMinimo ?? 0,
    ]);
    descargarCsv(
      `reporte-faltantes-${sufijo}.csv`,
      [
        "Código",
        "Medicamento",
        "Veces con faltante",
        "Veces agotado",
        "Unidades faltantes",
        "Sedes agotado",
        "Sedes bajo mínimo",
      ],
      filas
    );
    mostrarExito("CSV exportado", "Se descargó el ranking de medicamentos con faltantes.");
  };

  const tabActual = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reportes operativos</h1>
          <p className="mt-1 text-sm text-slate-600">
            {admin
              ? sedeActiva
                ? `Sede filtrada: ${sedeActiva.nombre} (${sedeActiva.codigo})`
                : "Consolidado de todas las sedes"
              : `Sede asignada: ${sedeActiva?.nombre ?? "Mi sede"}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportarTablaActivaCsv}
            disabled={cargando}
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
          >
            Exportar tabla a CSV
          </button>
          <button
            type="button"
            onClick={() => void cargarReportes()}
            disabled={cargando}
            className="rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {cargando ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </div>

      {/* Filtros de fecha */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="rep-desde" className="block text-xs font-medium text-slate-700">
                Desde
              </label>
              <input
                id="rep-desde"
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="mt-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900"
              />
            </div>
            <div>
              <label htmlFor="rep-hasta" className="block text-xs font-medium text-slate-700">
                Hasta
              </label>
              <input
                id="rep-hasta"
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="mt-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => aplicarRangoRapido(0)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => aplicarRangoRapido(6)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Últimos 7 días
            </button>
            <button
              type="button"
              onClick={() => aplicarRangoRapido(29)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Últimos 30 días
            </button>
          </div>
        </div>
        {errorRango && (
          <p className="mt-2 text-xs font-medium text-rose-700" role="alert">
            {errorRango}
          </p>
        )}
      </section>

      {/* Pestañas de reporte */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex flex-wrap gap-2" aria-label="Tipo de reporte">
          {TABS.map((item) => {
            const activo = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                  activo
                    ? "border-emerald-700 text-emerald-800"
                    : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      <p className="text-xs text-slate-500">{tabActual.descripcion}</p>

      {cargando ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Calculando indicadores del período…
        </div>
      ) : (
        <>
          {/* TAB 1: PEDIDOS */}
          {tab === "pedidos" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <KpiCard label="Total pedidos" valor={String(repPedidos?.totalPedidos ?? 0)} />
                <KpiCard
                  label="Entregados"
                  valor={String(repPedidos?.totalEntregados ?? 0)}
                  acento="emerald"
                />
                <KpiCard
                  label="Cancelados"
                  valor={String(repPedidos?.totalCancelados ?? 0)}
                  acento="rose"
                />
                <KpiCard
                  label="Vencidos"
                  valor={String(repPedidos?.totalVencidos ?? 0)}
                  acento="amber"
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-900">Pedidos por estado</h2>
                  <div className="mt-4 h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={datosPedidosEstado} margin={{ top: 8, right: 12, left: 0, bottom: 24 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="estado" tick={{ fontSize: 11 }} angle={-18} textAnchor="end" height={50} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="cantidad" name="Pedidos" fill="#047857" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-900">Pedidos registrados y entregados por día</h2>
                  {datosPedidosDia.length === 0 ? (
                    <EstadoVacio texto="Sin pedidos registrados en el rango seleccionado." />
                  ) : (
                    <div className="mt-4 h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={datosPedidosDia} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="total" name="Total" stroke="#0284c7" strokeWidth={2} />
                          <Line type="monotone" dataKey="entregados" name="Entregados" stroke="#059669" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                  <h2 className="text-sm font-bold text-slate-900">Detalle diario de pedidos</h2>
                  <span className="text-xs text-slate-500">{datosPedidosDia.length} día(s)</span>
                </div>
                {datosPedidosDia.length === 0 ? (
                  <EstadoVacio texto="No hay datos diarios para mostrar." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        <tr>
                          <th className="px-4 py-3">Fecha</th>
                          <th className="px-4 py-3 text-right">Total</th>
                          <th className="px-4 py-3 text-right">Entregados</th>
                          <th className="px-4 py-3 text-right">Cancelados</th>
                          <th className="px-4 py-3 text-right">Vencidos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {datosPedidosDia.map((fila) => (
                          <tr key={fila.fecha} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 font-medium text-slate-900">{fila.fecha}</td>
                            <td className="px-4 py-2.5 text-right">{fila.total}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">{fila.entregados}</td>
                            <td className="px-4 py-2.5 text-right text-rose-700">{fila.cancelados}</td>
                            <td className="px-4 py-2.5 text-right text-slate-600">{fila.vencidos}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TIEMPOS (CA-EMP-14) */}
          {tab === "tiempos" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <KpiCard
                  label="Pedidos entregados"
                  valor={String(repTiempos?.cantidadPedidosEntregados ?? 0)}
                />
                <KpiCard
                  label="Promedio preparación (RESERVADO → LISTO)"
                  valor={formatearMinutos(repTiempos?.promedioPreparacionMin)}
                  acento="sky"
                />
                <KpiCard
                  label="Promedio entrega (LISTO → ENTREGADO)"
                  valor={formatearMinutos(repTiempos?.promedioEntregaMin)}
                  acento="emerald"
                />
                <KpiCard
                  label="Tiempo total promedio"
                  valor={formatearMinutos(repTiempos?.promedioTotalMin)}
                  acento="amber"
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-900">
                    Tiempos promedio por día (minutos)
                  </h2>
                  {datosTiemposDia.length === 0 ? (
                    <EstadoVacio texto="No hay pedidos entregados en el rango seleccionado." />
                  ) : (
                    <div className="mt-4 h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={datosTiemposDia} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="preparacion" name="Preparación (min)" fill="#0284c7" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="entrega" name="Entrega (min)" fill="#059669" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-900">Comparativa por modalidad (minutos)</h2>
                  {datosTiemposModalidad.length === 0 ? (
                    <EstadoVacio texto="Sin pedidos entregados para comparar modalidades." />
                  ) : (
                    <div className="mt-4 h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={datosTiemposModalidad} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="modalidad" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="preparacion" name="Preparación (min)" fill="#0284c7" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="entrega" name="Entrega (min)" fill="#059669" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                  <h2 className="text-sm font-bold text-slate-900">Tabla de tiempos por día</h2>
                  <span className="text-xs text-slate-500">{datosTiemposDia.length} día(s)</span>
                </div>
                {datosTiemposDia.length === 0 ? (
                  <EstadoVacio texto="No hay pedidos entregados en el rango de fechas." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        <tr>
                          <th className="px-4 py-3">Fecha entrega</th>
                          <th className="px-4 py-3 text-right">Pedidos entregados</th>
                          <th className="px-4 py-3 text-right">Prom. preparación</th>
                          <th className="px-4 py-3 text-right">Prom. entrega</th>
                          <th className="px-4 py-3 text-right">Prom. total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {datosTiemposDia.map((fila) => (
                          <tr key={fila.fecha} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 font-medium text-slate-900">{fila.fecha}</td>
                            <td className="px-4 py-2.5 text-right">{fila.cantidadEntregados}</td>
                            <td className="px-4 py-2.5 text-right font-medium text-sky-800">
                              {formatearMinutos(fila.preparacion)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium text-emerald-800">
                              {formatearMinutos(fila.entrega)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                              {formatearMinutos(fila.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: TURNOS */}
          {tab === "turnos" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <KpiCard label="Total turnos" valor={String(repTurnos?.totalTurnos ?? 0)} />
                <KpiCard
                  label="Atendidos"
                  valor={String(repTurnos?.totalAtendidos ?? 0)}
                  acento="emerald"
                />
                <KpiCard
                  label="Vencidos"
                  valor={String(repTurnos?.totalVencidos ?? 0)}
                  acento="amber"
                />
                <KpiCard
                  label="Cancelados"
                  valor={String(repTurnos?.totalCancelados ?? 0)}
                  acento="rose"
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-bold text-slate-900">Turnos por franja horaria</h2>
                {datosTurnosFranja.length === 0 ? (
                  <EstadoVacio texto="No se registraron turnos en el rango seleccionado." />
                ) : (
                  <div className="mt-4 h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={datosTurnosFranja} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="franja" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="atendidos" name="Atendidos" stackId="a" fill="#059669" />
                        <Bar dataKey="pendientes" name="En espera / llamados" stackId="a" fill="#0284c7" />
                        <Bar dataKey="vencidos" name="Vencidos" stackId="a" fill="#d97706" />
                        <Bar dataKey="cancelados" name="Cancelados" stackId="a" fill="#e11d48" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                  <h2 className="text-sm font-bold text-slate-900">Tabla de turnos por franja</h2>
                  <span className="text-xs text-slate-500">{datosTurnosFranja.length} franja(s)</span>
                </div>
                {datosTurnosFranja.length === 0 ? (
                  <EstadoVacio texto="Sin turnos para mostrar." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        <tr>
                          <th className="px-4 py-3">Franja</th>
                          <th className="px-4 py-3 text-right">Total</th>
                          <th className="px-4 py-3 text-right">Atendidos</th>
                          <th className="px-4 py-3 text-right">En espera</th>
                          <th className="px-4 py-3 text-right">Llamados</th>
                          <th className="px-4 py-3 text-right">Vencidos</th>
                          <th className="px-4 py-3 text-right">Cancelados</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(repTurnos?.porFranja ?? []).map((fila) => (
                          <tr key={fila.franjaInicio} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 font-mono font-medium text-slate-900">
                              {fila.franjaInicio}
                            </td>
                            <td className="px-4 py-2.5 text-right">{fila.total ?? 0}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">
                              {fila.atendidos ?? 0}
                            </td>
                            <td className="px-4 py-2.5 text-right">{fila.enEspera ?? 0}</td>
                            <td className="px-4 py-2.5 text-right">{fila.llamados ?? 0}</td>
                            <td className="px-4 py-2.5 text-right text-amber-700">{fila.vencidos ?? 0}</td>
                            <td className="px-4 py-2.5 text-right text-rose-700">{fila.cancelados ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: FALTANTES */}
          {tab === "faltantes" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <KpiCard
                  label="Medicamentos en ranking"
                  valor={String(repFaltantes?.items?.length ?? 0)}
                />
                <KpiCard
                  label="Unidades faltantes (período)"
                  valor={String(
                    (repFaltantes?.items ?? []).reduce(
                      (acc, it) => acc + (it.unidadesFaltantes ?? 0),
                      0
                    )
                  )}
                  acento="rose"
                />
                <KpiCard
                  label="Medicamentos agotados hoy"
                  valor={String(
                    (repFaltantes?.items ?? []).filter((it) => (it.sedesAgotado ?? 0) > 0).length
                  )}
                  acento="amber"
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-bold text-slate-900">
                  Top medicamentos con más faltantes / agotados
                </h2>
                {datosFaltantesGrafico.length === 0 ? (
                  <EstadoVacio texto="No se detectaron faltantes ni medicamentos agotados en el rango." />
                ) : (
                  <div className="mt-4 h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={datosFaltantesGrafico}
                        layout="vertical"
                        margin={{ top: 8, right: 20, left: 20, bottom: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="medicamento" width={160} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="unidadesFaltantes" name="Unidades faltantes" fill="#e11d48" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="vecesFaltante" name="Veces con faltante" fill="#d97706" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                  <h2 className="text-sm font-bold text-slate-900">Ranking de faltantes y agotados</h2>
                  <span className="text-xs text-slate-500">
                    {repFaltantes?.items?.length ?? 0} medicamento(s)
                  </span>
                </div>
                {(repFaltantes?.items?.length ?? 0) === 0 ? (
                  <EstadoVacio texto="Sin medicamentos con faltantes en este período." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        <tr>
                          <th className="px-4 py-3">Código</th>
                          <th className="px-4 py-3">Medicamento</th>
                          <th className="px-4 py-3 text-right">Veces faltante</th>
                          <th className="px-4 py-3 text-right">Veces agotado</th>
                          <th className="px-4 py-3 text-right">Unidades faltantes</th>
                          <th className="px-4 py-3 text-right">Sedes agotado</th>
                          <th className="px-4 py-3 text-right">Sedes bajo mínimo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(repFaltantes?.items ?? []).map((item) => (
                          <tr key={item.medicamentoId} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 font-mono text-xs text-slate-700">
                              {item.medicamentoCodigo}
                            </td>
                            <td className="px-4 py-2.5 font-medium text-slate-900">
                              {item.medicamentoNombre}
                            </td>
                            <td className="px-4 py-2.5 text-right">{item.vecesFaltante ?? 0}</td>
                            <td className="px-4 py-2.5 text-right">{item.vecesAgotado ?? 0}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-rose-700">
                              {item.unidadesFaltantes ?? 0}
                            </td>
                            <td className="px-4 py-2.5 text-right text-amber-800">
                              {item.sedesAgotado ?? 0}
                            </td>
                            <td className="px-4 py-2.5 text-right text-slate-600">
                              {item.sedesBajoMinimo ?? 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function KpiCard({
  label,
  valor,
  acento = "slate",
}: {
  label: string;
  valor: string;
  acento?: "slate" | "emerald" | "sky" | "amber" | "rose";
}) {
  const colorValor: Record<string, string> = {
    slate: "text-slate-900",
    emerald: "text-emerald-700",
    sky: "text-sky-700",
    amber: "text-amber-700",
    rose: "text-rose-700",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold ${colorValor[acento]}`}>{valor}</p>
    </div>
  );
}

function EstadoVacio({ texto }: { texto: string }) {
  return <p className="py-10 text-center text-sm text-slate-500">{texto}</p>;
}

export default function ReportesPage() {
  return (
    <RoleGuard
      permitido={puedeVerReportes}
      mensajeDenegado="Solo farmacéuticos y administradores pueden consultar los reportes."
    >
      <ContenidoReportes />
    </RoleGuard>
  );
}
