"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { RoleGuard } from "@/components/RoleGuard";
import {
  farmaApi,
  type Notificacion,
  type NotificacionesListado,
} from "@/lib/api/client";
import { formatearFechaHora } from "@/lib/format";

function badgeTipoNotificacion(tipo?: string): { label: string; cls: string } {
  switch (tipo) {
    case "STOCK_BAJO":
      return {
        label: "Stock bajo",
        cls: "bg-amber-100 text-amber-900 border-amber-200",
      };
    case "NUEVO_PEDIDO":
    case "PEDIDO_RESERVADO":
      return {
        label: "Nuevo pedido",
        cls: "bg-sky-100 text-sky-800 border-sky-200",
      };
    case "INTEGRACION_ERROR":
      return {
        label: "Error integración",
        cls: "bg-rose-100 text-rose-800 border-rose-200",
      };
    default:
      return {
        label: tipo ?? "Aviso",
        cls: "bg-slate-100 text-slate-700 border-slate-200",
      };
  }
}

function NotificacionesContenido() {
  const { sesion, refrescarNotificaciones, mostrarExito } = useApp();
  const [soloNoLeidas, setSoloNoLeidas] = useState(false);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<NotificacionesListado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [marcandoId, setMarcandoId] = useState<string | null>(null);

  const accessToken = sesion?.accessToken;

  const cargar = useCallback(async () => {
    if (!accessToken) return;
    setCargando(true);
    try {
      const res = await farmaApi.listarNotificaciones(
        { soloNoLeidas: soloNoLeidas ? true : undefined, page, size: 20 },
        { token: accessToken }
      );
      setData(res);
    } catch {
      // Manejado globalmente
    } finally {
      setCargando(false);
    }
  }, [accessToken, soloNoLeidas, page]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void cargar();
    }, 0);
    return () => window.clearTimeout(id);
  }, [cargar]);

  async function marcarLeida(notif: Notificacion) {
    if (!sesion?.accessToken || !notif.id || notif.leida) return;
    setMarcandoId(notif.id);
    try {
      await farmaApi.marcarNotificacionLeida(notif.id, {
        token: sesion.accessToken,
      });
      mostrarExito("Notificación marcada como leída");
      await Promise.all([cargar(), refrescarNotificaciones()]);
    } catch {
      // Manejado globalmente
    } finally {
      setMarcandoId(null);
    }
  }

  const items = data?.content ?? [];
  const totalElements = data?.totalElements ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalElements / (data?.size ?? 20)));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Notificaciones
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Alertas de stock mínimo y nuevos pedidos de tu sede (RF-EMP-25,
            RF-EMP-26).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800">
            {data?.noLeidas ?? 0} sin leer
          </span>
          <button
            type="button"
            onClick={cargar}
            disabled={cargando}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Actualizar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setSoloNoLeidas(false);
            setPage(0);
          }}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold ${
            !soloNoLeidas
              ? "bg-emerald-700 text-white"
              : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
          }`}
        >
          Todas
        </button>
        <button
          type="button"
          onClick={() => {
            setSoloNoLeidas(true);
            setPage(0);
          }}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold ${
            soloNoLeidas
              ? "bg-emerald-700 text-white"
              : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
          }`}
        >
          Solo no leídas
        </button>
      </div>

      {/* Lista */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {cargando ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Cargando notificaciones…
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {soloNoLeidas
              ? "No tienes notificaciones sin leer."
              : "No hay notificaciones registradas."}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((notif) => {
              const badge = badgeTipoNotificacion(notif.tipo);
              return (
                <li
                  key={notif.id}
                  className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between ${
                    notif.leida ? "bg-white" : "bg-emerald-50/40"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {!notif.leida && (
                        <span
                          className="h-2 w-2 rounded-full bg-emerald-600"
                          title="No leída"
                        />
                      )}
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                      <span className="text-xs text-slate-400">
                        {formatearFechaHora(notif.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-semibold text-slate-900">
                      {notif.titulo}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {notif.mensaje}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {notif.referenciaTipo === "PEDIDO" && notif.referenciaId && (
                      <Link
                        href={`/pedidos/${notif.referenciaId}`}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Ver pedido
                      </Link>
                    )}
                    {notif.tipo === "STOCK_BAJO" && (
                      <Link
                        href="/inventario?bajoMinimo=true"
                        className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                      >
                        Ver inventario
                      </Link>
                    )}
                    {!notif.leida && (
                      <button
                        type="button"
                        disabled={marcandoId === notif.id}
                        onClick={() => marcarLeida(notif)}
                        className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                      >
                        {marcandoId === notif.id
                          ? "Marcando…"
                          : "Marcar leída"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>
            Página {page + 1} de {totalPages} ({totalElements} registros)
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

export default function NotificacionesPage() {
  return (
    <RoleGuard>
      <NotificacionesContenido />
    </RoleGuard>
  );
}
