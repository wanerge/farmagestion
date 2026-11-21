"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { PacienteGuard } from "@/components/PacienteGuard";
import { portalApi, type Notificacion } from "@/lib/api/client";
import { formatearFechaHora } from "@/lib/format";

const PAGE_SIZE = 15;

function ContenidoNotificaciones() {
  const { sesion, noLeidas, refrescarNotificaciones } = useApp();
  const token = sesion?.accessToken ?? "";

  const [soloNoLeidas, setSoloNoLeidas] = useState(false);
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<Notificacion[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [marcandoId, setMarcandoId] = useState<string | null>(null);

  const cargar = useCallback(
    async (silencioso = false) => {
      if (!token) return;
      if (!silencioso) setCargando(true);
      try {
        const res = await portalApi.listarNotificaciones(
          {
            soloNoLeidas: soloNoLeidas || undefined,
            page,
            size: PAGE_SIZE,
          },
          { token, notifyGlobalError: !silencioso }
        );
        setItems(res.content ?? []);
        setTotalElements(res.totalElements ?? 0);
      } catch {
        // Silencioso en polling
      } finally {
        if (!silencioso) setCargando(false);
      }
    },
    [token, soloNoLeidas, page]
  );

  useEffect(() => {
    const id = window.setTimeout(() => {
      void cargar(false);
    }, 0);
    return () => window.clearTimeout(id);
  }, [cargar]);

  // Refresco automático cada 20 s en la vista de notificaciones (RF-PAC-18)
  useEffect(() => {
    if (!token) return;
    const interval = window.setInterval(() => {
      void cargar(true);
      void refrescarNotificaciones();
    }, 20_000);
    return () => window.clearInterval(interval);
  }, [token, cargar, refrescarNotificaciones]);

  const marcarLeida = async (id: string) => {
    if (!token) return;
    setMarcandoId(id);
    try {
      await portalApi.marcarNotificacionLeida(id, { token });
      await Promise.all([cargar(true), refrescarNotificaciones()]);
    } catch {
      // Manejado globalmente
    } finally {
      setMarcandoId(null);
    }
  };

  const totalPaginas = Math.max(1, Math.ceil(totalElements / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Notificaciones
            </h1>
            {noLeidas > 0 && (
              <span className="rounded-full bg-rose-600 px-2.5 py-0.5 text-xs font-bold text-white">
                {noLeidas} sin leer
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Se actualizan automáticamente cada 20 segundos mientras la app está
            abierta.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void cargar(false);
            void refrescarNotificaciones();
          }}
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Actualizar
        </button>
      </div>

      {/* Filtro Todas / No leídas */}
      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
        <button
          type="button"
          onClick={() => {
            setSoloNoLeidas(false);
            setPage(0);
          }}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
            !soloNoLeidas
              ? "bg-teal-700 text-white"
              : "text-slate-600 hover:text-slate-900"
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
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
            soloNoLeidas
              ? "bg-teal-700 text-white"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Solo no leídas ({noLeidas})
        </button>
      </div>

      {cargando ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-slate-800">
            {soloNoLeidas
              ? "No tienes notificaciones pendientes por leer."
              : "Todavía no tienes notificaciones."}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Aquí recibirás avisos cuando tu pedido cambie de estado o cuando tu
            turno sea llamado.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((noti) => {
            const leida = Boolean(noti.leida);
            const esPedido =
              noti.referenciaTipo === "PEDIDO" && Boolean(noti.referenciaId);

            return (
              <article
                key={noti.id}
                className={`rounded-2xl border p-4 transition ${
                  leida
                    ? "border-slate-200 bg-white"
                    : "border-teal-300 bg-teal-50/40 shadow-xs"
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {!leida && (
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full bg-teal-600"
                          aria-label="No leída"
                        />
                      )}
                      <h2 className="text-sm font-bold text-slate-900">
                        {noti.titulo}
                      </h2>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-700">
                      {noti.mensaje}
                    </p>
                    <p className="mt-1.5 text-[11px] text-slate-400">
                      {formatearFechaHora(noti.createdAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {esPedido && (
                      <Link
                        href={`/pedidos/${noti.referenciaId}`}
                        className="rounded-xl border border-teal-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-50"
                      >
                        Ver pedido
                      </Link>
                    )}
                    {!leida && noti.id && (
                      <button
                        type="button"
                        disabled={marcandoId === noti.id}
                        onClick={() => void marcarLeida(noti.id!)}
                        className="rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
                      >
                        {marcandoId === noti.id
                          ? "Marcando…"
                          : "Marcar leída"}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!cargando && totalPaginas > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            disabled={page <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
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
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}

export default function NotificacionesPage() {
  return (
    <PacienteGuard>
      <ContenidoNotificaciones />
    </PacienteGuard>
  );
}
