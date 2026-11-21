"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { RoleGuard } from "@/components/RoleGuard";
import {
  farmaApi,
  type EstadoPedido,
  type ModalidadPedido,
  type PaginaPedidos,
} from "@/lib/api/client";
import { esAdmin, puedeGestionarPedidosYTurnos } from "@/lib/auth/permisos";
import {
  CLASE_ESTADO_PEDIDO,
  CLASE_ESTADO_TURNO,
  ETIQUETA_ESTADO_PEDIDO,
  ETIQUETA_ESTADO_TURNO,
  ETIQUETA_MODALIDAD,
  formatearFechaHora,
  formatearHora,
  formatearTiempoRestante,
} from "@/lib/format";

const ESTADOS: EstadoPedido[] = [
  "RESERVADO",
  "EN_PREPARACION",
  "LISTO",
  "EN_RUTA",
  "ENTREGADO",
  "CANCELADO",
  "VENCIDO",
];

function PedidosContenido() {
  const searchParams = useSearchParams();
  const { sesion, sedeSeleccionadaId, sedeActiva } = useApp();

  const estadoInicial = (searchParams.get("estado") as EstadoPedido | null) ?? "";
  const modalidadInicial =
    (searchParams.get("modalidad") as ModalidadPedido | null) ?? "";

  const [estado, setEstado] = useState<EstadoPedido | "">(estadoInicial);
  const [modalidad, setModalidad] = useState<ModalidadPedido | "">(
    modalidadInicial
  );
  const [fecha, setFecha] = useState(searchParams.get("fecha") ?? "");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<PaginaPedidos | null>(null);
  const [cargando, setCargando] = useState(true);

  const usuario = sesion?.usuario;
  const admin = esAdmin(usuario);
  const sedeFiltro = admin ? sedeSeleccionadaId || undefined : undefined;

  const accessToken = sesion?.accessToken;

  const cargar = useCallback(async () => {
    if (!accessToken) return;
    setCargando(true);
    try {
      const res = await farmaApi.listarPedidos(
        {
          sedeId: sedeFiltro,
          estado: estado || undefined,
          modalidad: modalidad || undefined,
          fecha: fecha || undefined,
          page,
          size: 20,
        },
        { token: accessToken }
      );
      setData(res);
    } catch {
      // Manejado globalmente
    } finally {
      setCargando(false);
    }
  }, [accessToken, sedeFiltro, estado, modalidad, fecha, page]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void cargar();
    }, 0);
    return () => window.clearTimeout(id);
  }, [cargar]);

  const items = data?.content ?? [];
  const totalElements = data?.totalElements ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalElements / (data?.size ?? 20)));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Bandeja de pedidos
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">
            {sedeActiva
              ? `${sedeActiva.nombre} (${sedeActiva.codigo})`
              : admin
                ? "Todas las sedes"
                : "Pedidos de tu sede"}{" "}
            · Ordenados por urgencia de vencimiento (RF-EMP-08)
          </p>
        </div>

        <button
          type="button"
          onClick={cargar}
          disabled={cargando}
          className="self-start rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 sm:self-auto"
        >
          {cargando ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      {/* Filtros (RF-EMP-08) */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label
            htmlFor="filtro-estado"
            className="block text-xs font-semibold text-slate-700"
          >
            Estado
          </label>
          <select
            id="filtro-estado"
            value={estado}
            onChange={(e) => {
              setEstado(e.target.value as EstadoPedido | "");
              setPage(0);
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Todos los estados</option>
            {ESTADOS.map((st) => (
              <option key={st} value={st}>
                {ETIQUETA_ESTADO_PEDIDO[st]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="filtro-modalidad"
            className="block text-xs font-semibold text-slate-700"
          >
            Modalidad
          </label>
          <select
            id="filtro-modalidad"
            value={modalidad}
            onChange={(e) => {
              setModalidad(e.target.value as ModalidadPedido | "");
              setPage(0);
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Todas</option>
            <option value="RECOGER">Recoger en sede</option>
            <option value="DOMICILIO">Domicilio</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="filtro-fecha"
            className="block text-xs font-semibold text-slate-700"
          >
            Fecha de creación
          </label>
          <input
            id="filtro-fecha"
            type="date"
            value={fecha}
            onChange={(e) => {
              setFecha(e.target.value);
              setPage(0);
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={() => {
              setEstado("");
              setModalidad("");
              setFecha("");
              setPage(0);
            }}
            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Pedido / Fórmula</th>
                <th className="px-4 py-3">Paciente</th>
                {admin && <th className="px-4 py-3">Sede</th>}
                <th className="px-4 py-3">Modalidad / Turno</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Vencimiento reserva</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                <tr>
                  <td
                    colSpan={admin ? 7 : 6}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    Cargando pedidos…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={admin ? 7 : 6}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No hay pedidos que coincidan con los filtros actuales.
                  </td>
                </tr>
              ) : (
                items.map((pedido) => {
                  const esActivo =
                    pedido.estado === "RESERVADO" ||
                    pedido.estado === "EN_PREPARACION" ||
                    pedido.estado === "LISTO";
                  const urgencia = formatearTiempoRestante(pedido.expiraEn);
                  const mio =
                    Boolean(pedido.asignadoA) && pedido.asignadoA === usuario?.id;

                  return (
                    <tr key={pedido.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Link
                            href={`/pedidos/${pedido.id}`}
                            className="font-mono text-sm font-bold text-emerald-800 hover:underline"
                          >
                            {pedido.codigo}
                          </Link>
                          {pedido.esParcial && (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                              PARCIAL
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 font-mono text-xs text-slate-500">
                          {pedido.formulaCodigo}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {pedido.pacienteNombre ?? "—"}
                        </p>
                        <p className="font-mono text-xs text-slate-500">
                          Doc: {pedido.pacienteDocumento ?? "—"}
                        </p>
                      </td>

                      {admin && (
                        <td className="px-4 py-3 text-xs text-slate-600">
                          <p className="font-medium text-slate-800">
                            {pedido.sedeNombre}
                          </p>
                          <p className="font-mono text-[11px]">
                            {pedido.sedeCodigo}
                          </p>
                        </td>
                      )}

                      <td className="px-4 py-3 text-xs">
                        <p className="font-semibold text-slate-800">
                          {pedido.modalidad
                            ? ETIQUETA_MODALIDAD[pedido.modalidad]
                            : "—"}
                        </p>
                        {pedido.turno && (
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-900">
                              {pedido.turno.codigo}
                            </span>
                            <span className="text-slate-500">
                              {formatearHora(pedido.turno.franjaInicio)}
                            </span>
                            {pedido.turno.estado && (
                              <span
                                className={`rounded-full border px-1.5 py-0.2 text-[10px] font-semibold ${CLASE_ESTADO_TURNO[pedido.turno.estado]}`}
                              >
                                {ETIQUETA_ESTADO_TURNO[pedido.turno.estado]}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {pedido.estado && (
                          <span
                            className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${CLASE_ESTADO_PEDIDO[pedido.estado]}`}
                          >
                            {ETIQUETA_ESTADO_PEDIDO[pedido.estado]}
                          </span>
                        )}
                        {pedido.estado === "EN_PREPARACION" && (
                          <p className="mt-1 text-[11px] text-slate-500">
                            {mio ? "Asignado a ti" : "Asignado a otro empleado"}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3 text-xs">
                        {esActivo ? (
                          <div>
                            <p
                              className={`font-semibold ${
                                urgencia.urgente ? "text-rose-700" : "text-slate-800"
                              }`}
                            >
                              {urgencia.texto}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {formatearFechaHora(pedido.expiraEn)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-500">
                            {formatearFechaHora(
                              pedido.entregadoEn ?? pedido.updatedAt ?? pedido.createdAt
                            )}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/pedidos/${pedido.id}`}
                          className="inline-block rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                        >
                          Gestionar
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>
            Página {page + 1} de {totalPages} ({totalElements} pedidos)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium hover:bg-slate-100 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium hover:bg-slate-100 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PedidosPage() {
  return (
    <RoleGuard
      permitido={puedeGestionarPedidosYTurnos}
      mensajeDenegado="Solo auxiliares, farmacéuticos y administradores pueden gestionar la bandeja de pedidos."
    >
      <Suspense
        fallback={
          <div className="py-10 text-center text-sm text-slate-500">
            Cargando bandeja de pedidos…
          </div>
        }
      >
        <PedidosContenido />
      </Suspense>
    </RoleGuard>
  );
}
