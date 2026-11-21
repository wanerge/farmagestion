"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { RoleGuard } from "@/components/RoleGuard";
import {
  farmaApi,
  type EstadoPedido,
  type Notificacion,
  type ResumenTablero,
} from "@/lib/api/client";
import {
  esAdmin,
  esDomiciliario,
  puedeArmarRutas,
  puedeGestionarPedidosYTurnos,
} from "@/lib/auth/permisos";
import {
  CLASE_ESTADO_PEDIDO,
  CLASE_NIVEL_STOCK,
  ETIQUETA_ESTADO_PEDIDO,
  ETIQUETA_NIVEL_STOCK,
  fechaHoyBogota,
  formatearFechaHora,
} from "@/lib/format";

const ESTADOS_ORDEN: EstadoPedido[] = [
  "RESERVADO",
  "EN_PREPARACION",
  "LISTO",
  "EN_RUTA",
  "ENTREGADO",
  "CANCELADO",
  "VENCIDO",
];

function TableroContenido() {
  const {
    sesion,
    sedes,
    sedeSeleccionadaId,
    sedeActiva,
    refrescarNotificaciones,
  } = useApp();

  const [resumen, setResumen] = useState<ResumenTablero | null>(null);
  const [alertasRecientes, setAlertasRecientes] = useState<Notificacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [actualizadoEn, setActualizadoEn] = useState<string>("");

  const usuario = sesion?.usuario;
  const admin = esAdmin(usuario);
  const domiciliario = esDomiciliario(usuario);
  const sedeFiltro = admin ? sedeSeleccionadaId || undefined : undefined;
  const sedeTurnos = admin ? sedeSeleccionadaId || sedes[0]?.id : undefined;

  const cargarDatos = useCallback(async () => {
    if (!sesion?.accessToken) return;
    setCargando(true);
    try {
      const hoy = fechaHoyBogota();
      const [notifsRes, tableroRes] = await Promise.all([
        farmaApi.listarNotificaciones(
          { soloNoLeidas: true, page: 0, size: 6 },
          { token: sesion.accessToken }
        ),
        puedeGestionarPedidosYTurnos(sesion.usuario)
          ? farmaApi.obtenerResumenTablero(
              {
                sedeId: sedeFiltro,
                fechaHoy: hoy,
                consultarTurnos: !admin || Boolean(sedeTurnos),
              },
              { token: sesion.accessToken }
            )
          : Promise.resolve(null),
      ]);

      // Si es ADMIN con "Todas las sedes", obtenemos los turnos de la sede seleccionada si aplica
      let tableroFinal = tableroRes;
      if (tableroFinal && admin && !sedeFiltro && sedeTurnos) {
        try {
          const turnos = await farmaApi.listarTurnos(
            { sedeId: sedeTurnos, fecha: hoy },
            { token: sesion.accessToken, notifyGlobalError: false }
          );
          const turnosHoy = {
            enEspera: turnos.filter((t) => t.estado === "EN_ESPERA").length,
            llamados: turnos.filter((t) => t.estado === "LLAMADO").length,
            atendidos: turnos.filter((t) => t.estado === "ATENDIDO").length,
            vencidos: turnos.filter((t) => t.estado === "VENCIDO").length,
            cancelados: turnos.filter((t) => t.estado === "CANCELADO").length,
            total: turnos.length,
          };
          tableroFinal = { ...tableroFinal, turnosHoy };
        } catch {
          // Mantener ceros si no hay sede
        }
      }

      setAlertasRecientes(notifsRes.content ?? []);
      setResumen(tableroFinal);
      setActualizadoEn(formatearFechaHora(new Date().toISOString()));
      await refrescarNotificaciones();
    } catch {
      // Manejado por el interceptor global de problem+json
    } finally {
      setCargando(false);
    }
  }, [sesion, sedeFiltro, admin, sedeTurnos, refrescarNotificaciones]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void cargarDatos();
    }, 0);
    return () => window.clearTimeout(id);
  }, [cargarDatos]);

  if (domiciliario) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <span className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-800">
            Perfil Domiciliario
          </span>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">
            Hola, {usuario?.nombres ?? "domiciliario"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Consulta tus rutas asignadas para hoy en el mapa, revisa el orden de
            las paradas y registra cada entrega o intento fallido.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/mi-ruta"
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Ir a Mi ruta
            </Link>
            <Link
              href="/notificaciones"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Ver mis notificaciones
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const sedeParaSala = sedeActiva ?? sedes[0] ?? null;

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Tablero operativo
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">
            {sedeActiva
              ? `${sedeActiva.nombre} (${sedeActiva.codigo})`
              : admin
                ? "Vista consolidada de todas las sedes"
                : "Resumen operativo de tu sede"}
            {actualizadoEn ? ` · Actualizado ${actualizadoEn}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={cargarDatos}
            disabled={cargando}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            {cargando ? "Actualizando…" : "Actualizar"}
          </button>
          <Link
            href="/pedidos"
            className="rounded-lg bg-emerald-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Ir a pedidos
          </Link>
        </div>
      </div>

      {/* Indicadores principales (RF-EMP-02) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pedidos activos
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {resumen
              ? resumen.pedidosPorEstado.RESERVADO +
                resumen.pedidosPorEstado.EN_PREPARACION +
                resumen.pedidosPorEstado.LISTO +
                resumen.pedidosPorEstado.EN_RUTA
              : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {resumen
              ? `${resumen.pedidosPorEstado.RESERVADO} reservados · ${resumen.pedidosPorEstado.EN_PREPARACION} en preparación · ${resumen.pedidosPorEstado.LISTO} listos`
              : "Cargando…"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Turnos de hoy
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {resumen ? resumen.turnosHoy.total : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {resumen
              ? `${resumen.turnosHoy.enEspera} en espera · ${resumen.turnosHoy.llamados} llamados · ${resumen.turnosHoy.atendidos} atendidos`
              : "Cargando…"}
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            Medicamentos bajo mínimo
          </p>
          <p className="mt-2 text-3xl font-bold text-amber-950">
            {resumen ? resumen.medicamentosBajoMinimo.total : "—"}
          </p>
          <p className="mt-1 text-xs text-amber-800">
            {resumen
              ? `${resumen.medicamentosBajoMinimo.agotados} agotados actualmente`
              : "Cargando…"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Domicilios del día
            </p>
            {puedeArmarRutas(usuario) && (
              <Link
                href="/domicilios"
                className="text-xs font-semibold text-emerald-700 hover:underline"
              >
                Rutas →
              </Link>
            )}
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {resumen ? resumen.domiciliosHoy : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Pedidos modalidad domicilio creados hoy
          </p>
        </div>
      </div>

      {/* Pedidos por estado */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900">
            Pedidos por estado
          </h2>
          <Link
            href="/pedidos"
            className="text-xs font-semibold text-emerald-700 hover:underline"
          >
            Abrir bandeja completa →
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {ESTADOS_ORDEN.map((estado) => (
            <Link
              key={estado}
              href={`/pedidos?estado=${estado}`}
              className="group rounded-xl border border-slate-200 bg-slate-50/70 p-3 transition hover:border-emerald-300 hover:bg-white"
            >
              <span
                className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${CLASE_ESTADO_PEDIDO[estado]}`}
              >
                {ETIQUETA_ESTADO_PEDIDO[estado]}
              </span>
              <p className="mt-2 text-2xl font-bold text-slate-900 group-hover:text-emerald-700">
                {resumen ? resumen.pedidosPorEstado[estado] : "—"}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Accesos rápidos + Alertas */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Alertas de inventario bajo mínimo */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Stock bajo el mínimo
              </h2>
              <p className="text-xs text-slate-500">
                Medicamentos que requieren reposición en la sede (RN-07).
              </p>
            </div>
            <Link
              href="/inventario?bajoMinimo=true"
              className="text-xs font-semibold text-emerald-700 hover:underline"
            >
              Ver todos →
            </Link>
          </div>

          {cargando && !resumen ? (
            <p className="mt-4 text-sm text-slate-500">Cargando inventario…</p>
          ) : !resumen || resumen.medicamentosBajoMinimo.muestra.length === 0 ? (
            <p className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
              No hay medicamentos por debajo del stock mínimo en este momento.
            </p>
          ) : (
            <div className="mt-4 divide-y divide-slate-100">
              {resumen.medicamentosBajoMinimo.muestra.map((item) => (
                <div
                  key={item.id ?? `${item.sedeId}-${item.medicamentoId}`}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {item.medicamentoNombre}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.medicamentoCodigo}
                      {admin && item.sedeNombre ? ` · ${item.sedeNombre}` : ""} ·
                      Mínimo: {item.stockMinimo}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">
                      {item.disponible} disp.
                    </span>
                    {item.nivel && (
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${CLASE_NIVEL_STOCK[item.nivel]}`}
                      >
                        {ETIQUETA_NIVEL_STOCK[item.nivel]}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Notificaciones recientes no leídas */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Notificaciones sin leer
              </h2>
              <p className="text-xs text-slate-500">
                Nuevos pedidos y alertas de stock mínimo (RF-EMP-25, RF-EMP-26).
              </p>
            </div>
            <Link
              href="/notificaciones"
              className="text-xs font-semibold text-emerald-700 hover:underline"
            >
              Ver todas →
            </Link>
          </div>

          {cargando && alertasRecientes.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              Cargando notificaciones…
            </p>
          ) : alertasRecientes.length === 0 ? (
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              Estás al día. No tienes notificaciones pendientes por leer.
            </p>
          ) : (
            <div className="mt-4 divide-y divide-slate-100">
              {alertasRecientes.map((notif) => (
                <div key={notif.id} className="py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {notif.titulo}
                    </p>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {formatearFechaHora(notif.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-600">{notif.mensaje}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Accesos rápidos */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Accesos rápidos</h2>
        <div className="mt-3 flex flex-wrap gap-2.5">
          <Link
            href="/pedidos?estado=RESERVADO"
            className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
          >
            Pedidos por tomar
          </Link>
          <Link
            href="/pedidos?estado=LISTO"
            className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
          >
            Pedidos listos para entregar
          </Link>
          <Link
            href="/turnos"
            className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
          >
            Cola de turnos de hoy
          </Link>
          <Link
            href="/inventario"
            className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
          >
            Consultar inventario y kárdex
          </Link>
          {sedeParaSala?.codigo && (
            <Link
              href={`/sala/${encodeURIComponent(sedeParaSala.codigo)}`}
              target="_blank"
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              Pantalla pública de sala ({sedeParaSala.codigo}) ↗
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}

export default function HomePage() {
  return (
    <RoleGuard>
      <TableroContenido />
    </RoleGuard>
  );
}
