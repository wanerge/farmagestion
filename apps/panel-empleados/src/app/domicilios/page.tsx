"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Modal } from "@/components/Modal";
import { RoleGuard } from "@/components/RoleGuard";
import type { OrigenSedeMapa } from "@/components/MapaRutaLeaflet";
import {
  farmaApi,
  type DomiciliosPendientes,
  type EstadoPedido,
  type EstadoRuta,
  type EstadoRutaParada,
  type RutaDetalle,
  type RutaParada,
} from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import { esAdmin, puedeArmarRutas } from "@/lib/auth/permisos";
import {
  CLASE_ESTADO_PARADA,
  CLASE_ESTADO_PEDIDO,
  CLASE_ESTADO_RUTA,
  ETIQUETA_ESTADO_PARADA,
  ETIQUETA_ESTADO_PEDIDO,
  ETIQUETA_ESTADO_RUTA,
  fechaHoyBogota,
  formatearDistanciaKm,
  formatearFechaHora,
  formatearTiempoRestante,
} from "@/lib/format";

const MapaRutaLeaflet = dynamic(
  () => import("@/components/MapaRutaLeaflet"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-80 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-xs text-slate-500 sm:h-96">
        Cargando mapa de domicilios…
      </div>
    ),
  }
);

function DomiciliosContenido() {
  const {
    sesion,
    sedes,
    sedeSeleccionadaId,
    setSedeSeleccionadaId,
    mostrarExito,
    refrescarNotificaciones,
  } = useApp();

  const token = sesion?.accessToken ?? "";
  const admin = esAdmin(sesion?.usuario);
  const sedeEfectivaId = admin
    ? sedeSeleccionadaId || sedes[0]?.id || ""
    : sesion?.usuario?.sedeId || "";

  const [fechaRutas, setFechaRutas] = useState<string>(() => fechaHoyBogota());
  const [pendientesData, setPendientesData] =
    useState<DomiciliosPendientes | null>(null);
  const [rutas, setRutas] = useState<RutaDetalle[]>([]);
  const [cargando, setCargando] = useState(true);

  // Selección para armar nueva ruta (RF-EMP-20)
  const [seleccionadosIds, setSeleccionadosIds] = useState<string[]>([]);
  const [domiciliarioId, setDomiciliarioId] = useState<string>("");
  const [creandoRuta, setCreandoRuta] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  // Ruta seleccionada para visualizar / reordenar / iniciar (RF-EMP-21)
  const [rutaActivaId, setRutaActivaId] = useState<string | null>(null);
  const [ordenBorrador, setOrdenBorrador] = useState<{
    rutaId: string;
    paradas: RutaParada[];
  } | null>(null);
  const [guardandoOrden, setGuardandoOrden] = useState(false);
  const [modalIniciarAbierto, setModalIniciarAbierto] = useState(false);
  const [iniciandoRuta, setIniciandoRuta] = useState(false);

  const cargarTodo = useCallback(async () => {
    if (!token) return;
    if (admin && !sedeEfectivaId) {
      setCargando(false);
      return;
    }

    setCargando(true);
    setErrorAccion(null);
    try {
      const querySede = admin ? { sedeId: sedeEfectivaId } : {};
      const [pendientesRes, rutasRes] = await Promise.all([
        farmaApi.listarDomiciliosPendientes(querySede, { token }),
        farmaApi.listarRutas(
          { ...querySede, fecha: fechaRutas },
          { token }
        ),
      ]);

      setPendientesData(pendientesRes);
      setRutas(rutasRes);

      // Conservar solo pedidos aún disponibles
      const disponiblesIds = new Set(
        (pendientesRes.pedidos ?? [])
          .map((p) => p.id)
          .filter((id): id is string => Boolean(id))
      );
      setSeleccionadosIds((prev) =>
        prev.filter((id) => disponiblesIds.has(id))
      );

      // Seleccionar domiciliario por defecto si no hay uno válido
      const doms = pendientesRes.domiciliarios ?? [];
      setDomiciliarioId((prev) => {
        if (prev && doms.some((d) => d.usuarioId === prev)) return prev;
        return doms[0]?.usuarioId ?? "";
      });

      // Mantener ruta activa si aún está en la lista
      setRutaActivaId((prev) => {
        if (prev && rutasRes.some((r) => r.id === prev)) return prev;
        return null;
      });
    } catch {
      // Manejado globalmente por problem+json
    } finally {
      setCargando(false);
    }
  }, [token, admin, sedeEfectivaId, fechaRutas]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void cargarTodo();
    }, 0);
    return () => window.clearTimeout(id);
  }, [cargarTodo]);

  const rutaActiva = useMemo(
    () => rutas.find((r) => r.id === rutaActivaId) ?? null,
    [rutas, rutaActivaId]
  );

  const ordenModificado = Boolean(
    rutaActiva?.id && ordenBorrador?.rutaId === rutaActiva.id
  );

  const paradasEditables = useMemo(() => {
    if (!rutaActiva) return [];
    if (ordenBorrador && ordenBorrador.rutaId === rutaActiva.id) {
      return ordenBorrador.paradas;
    }
    return [...(rutaActiva.paradas ?? [])].sort(
      (a, b) => (a.orden ?? 0) - (b.orden ?? 0)
    );
  }, [rutaActiva, ordenBorrador]);

  const maxParadas = pendientesData?.maxParadas ?? 8;
  const maxIntentos = pendientesData?.maxIntentos ?? 2;
  const pedidosPendientes = useMemo(
    () => pendientesData?.pedidos ?? [],
    [pendientesData]
  );
  const domiciliarios = pendientesData?.domiciliarios ?? [];

  const toggleSeleccionPedido = useCallback(
    (pedidoId: string) => {
      setErrorAccion(null);
      setSeleccionadosIds((prev) => {
        if (prev.includes(pedidoId)) {
          return prev.filter((id) => id !== pedidoId);
        }
        if (prev.length >= maxParadas) {
          setErrorAccion(
            `Solo puedes seleccionar hasta ${maxParadas} paradas por ruta (parámetro domicilio.max_paradas).`
          );
          return prev;
        }
        return [...prev, pedidoId];
      });
    },
    [maxParadas]
  );

  const seleccionarTodosPosibles = () => {
    setErrorAccion(null);
    const ids = pedidosPendientes
      .map((p) => p.id)
      .filter((id): id is string => Boolean(id))
      .slice(0, maxParadas);
    setSeleccionadosIds(ids);
  };

  const generarRuta = async () => {
    if (!token) return;
    setErrorAccion(null);
    if (seleccionadosIds.length === 0) {
      setErrorAccion("Selecciona al menos un pedido listo para armar la ruta.");
      return;
    }
    if (!domiciliarioId) {
      setErrorAccion("Selecciona un domiciliario para asignar la ruta.");
      return;
    }

    setCreandoRuta(true);
    try {
      const nueva = await farmaApi.crearRuta(
        { domiciliarioId, pedidoIds: seleccionadosIds },
        admin && sedeEfectivaId ? { sedeId: sedeEfectivaId } : {},
        { token, notifyGlobalError: false }
      );
      setSeleccionadosIds([]);
      setFechaRutas(nueva.fecha ?? fechaHoyBogota());
      await cargarTodo();
      if (nueva.id) {
        setRutaActivaId(nueva.id);
      }
      mostrarExito(
        "Ruta planeada generada",
        `${nueva.paradas?.length ?? 0} parada(s) ordenadas · Distancia estimada ${formatearDistanciaKm(
          nueva.distanciaKm
        )} en línea recta.`
      );
    } catch (err) {
      setErrorAccion(
        isApiError(err)
          ? err.mensajeUsuario
          : "No fue posible generar la ruta."
      );
    } finally {
      setCreandoRuta(false);
    }
  };

  const moverParada = (index: number, delta: -1 | 1) => {
    if (!rutaActiva?.id) return;
    const destino = index + delta;
    if (destino < 0 || destino >= paradasEditables.length) return;
    const copia = [...paradasEditables];
    const [movida] = copia.splice(index, 1);
    copia.splice(destino, 0, movida);
    const renumeradas = copia.map((p, idx) => ({ ...p, orden: idx + 1 }));
    setOrdenBorrador({ rutaId: rutaActiva.id, paradas: renumeradas });
  };

  const guardarNuevoOrden = async () => {
    if (!token || !rutaActiva?.id) return;
    const paradaIds = paradasEditables
      .map((p) => p.id)
      .filter((id): id is string => Boolean(id));
    if (paradaIds.length === 0) return;

    setGuardandoOrden(true);
    setErrorAccion(null);
    try {
      const actualizada = await farmaApi.reordenarRuta(
        rutaActiva.id,
        { paradaIds },
        { token, notifyGlobalError: false }
      );
      setRutas((prev) =>
        prev.map((r) => (r.id === actualizada.id ? actualizada : r))
      );
      setOrdenBorrador(null);
      mostrarExito(
        "Orden actualizado",
        `Nueva distancia estimada: ${formatearDistanciaKm(
          actualizada.distanciaKm
        )} en línea recta.`
      );
    } catch (err) {
      setErrorAccion(
        isApiError(err)
          ? err.mensajeUsuario
          : "No fue posible actualizar el orden de la ruta."
      );
    } finally {
      setGuardandoOrden(false);
    }
  };

  const confirmarIniciarRuta = async () => {
    if (!token || !rutaActiva?.id) return;
    setIniciandoRuta(true);
    setErrorAccion(null);
    try {
      const iniciada = await farmaApi.iniciarRuta(rutaActiva.id, {
        token,
        notifyGlobalError: false,
      });
      setRutas((prev) =>
        prev.map((r) => (r.id === iniciada.id ? iniciada : r))
      );
      setModalIniciarAbierto(false);
      await refrescarNotificaciones();
      mostrarExito(
        "Ruta iniciada",
        "La ruta pasó a En curso, los pedidos quedaron En ruta y los pacientes fueron notificados."
      );
    } catch (err) {
      setErrorAccion(
        isApiError(err)
          ? err.mensajeUsuario
          : "No fue posible iniciar la ruta."
      );
      setModalIniciarAbierto(false);
    } finally {
      setIniciandoRuta(false);
    }
  };

  const origenMapa: OrigenSedeMapa | null = useMemo(() => {
    if (rutaActiva) {
      return {
        nombre: rutaActiva.sedeNombre,
        codigo: rutaActiva.sedeCodigo,
        direccion: rutaActiva.sedeDireccion,
        latitud: rutaActiva.sedeLatitud,
        longitud: rutaActiva.sedeLongitud,
      };
    }
    if (pendientesData) {
      return {
        nombre: pendientesData.sedeNombre,
        codigo: pendientesData.sedeCodigo,
        direccion: pendientesData.sedeDireccion,
        latitud: pendientesData.sedeLatitud,
        longitud: pendientesData.sedeLongitud,
      };
    }
    return null;
  }, [rutaActiva, pendientesData]);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Domicilios y rutas
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">
            {pendientesData
              ? `${pendientesData.sedeNombre} (${pendientesData.sedeCodigo}) · Máximo ${maxParadas} paradas por ruta · ${maxIntentos} intentos por pedido`
              : "Planea rutas heurísticas con vecino más cercano + 2-opt, ajusta el orden e inicia el despacho."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {admin && sedes.length > 0 && (
            <select
              aria-label="Sede para domicilios"
              value={sedeEfectivaId}
              onChange={(e) => setSedeSeleccionadaId(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800"
            >
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre} ({s.codigo})
                </option>
              ))}
            </select>
          )}
          <input
            type="date"
            aria-label="Fecha de rutas"
            value={fechaRutas}
            onChange={(e) => setFechaRutas(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
          />
          <button
            type="button"
            onClick={() => void cargarTodo()}
            disabled={cargando}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            {cargando ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </div>

      {errorAccion && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900"
        >
          {errorAccion}
        </div>
      )}

      {/* Mapa principal + leyenda */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {rutaActiva
                ? `Vista de ruta · ${rutaActiva.domiciliarioNombre ?? "Domiciliario"} (${formatearDistanciaKm(
                    rutaActiva.distanciaKm
                  )})`
                : "Mapa de pedidos DOMICILIO listos para rutear"}
            </h2>
            <p className="text-xs text-slate-500">
              {rutaActiva
                ? "Distancia estimada en línea recta (Haversine, sin regreso obligatorio a la sede)."
                : "Haz clic en los marcadores o en la lista para seleccionar pedidos y armar una ruta."}
            </p>
          </div>
          {rutaActiva && (
            <button
              type="button"
              onClick={() => setRutaActivaId(null)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Volver a pedidos pendientes
            </button>
          )}
        </div>

        <MapaRutaLeaflet
          origen={origenMapa}
          pendientes={rutaActiva ? [] : pedidosPendientes}
          seleccionadosIds={seleccionadosIds}
          onToggleSeleccion={rutaActiva ? undefined : toggleSeleccionPedido}
          paradas={rutaActiva ? paradasEditables : []}
        />

        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-emerald-700" />
            Sede origen (S)
          </span>
          {rutaActiva ? (
            <>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full bg-indigo-600" />
                Parada pendiente
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full bg-emerald-600" />
                Entregada
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full bg-rose-600" />
                Fallida
              </span>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full bg-sky-600" />
                Pendiente por asignar
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full bg-indigo-600" />
                Seleccionado ({seleccionadosIds.length}/{maxParadas})
              </span>
            </>
          )}
        </div>
      </section>

      {/* Grid: Izquierda armar nueva ruta · Derecha rutas del día / detalle */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Columna izquierda: Pedidos pendientes para nueva ruta (RF-EMP-19, RF-EMP-20) */}
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Pedidos listos para domicilio ({pedidosPendientes.length})
              </h2>
              <p className="text-xs text-slate-500">
                Seleccionados: <strong>{seleccionadosIds.length}</strong> /{" "}
                {maxParadas}
              </p>
            </div>
            {pedidosPendientes.length > 0 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={seleccionarTodosPosibles}
                  className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Seleccionar hasta {maxParadas}
                </button>
                {seleccionadosIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSeleccionadosIds([])}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            )}
          </div>

          {cargando ? (
            <div className="space-y-2">
              <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
            </div>
          ) : pedidosPendientes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
              No hay pedidos <strong>DOMICILIO</strong> en estado{" "}
              <strong>LISTO</strong> pendientes de ruta en esta sede.
              <div className="mt-3">
                <Link
                  href="/pedidos"
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                >
                  Ir a bandeja de pedidos →
                </Link>
              </div>
            </div>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
              {pedidosPendientes.map((pedido) => {
                const pid = pedido.id ?? "";
                const checked = seleccionadosIds.includes(pid);
                const vence = formatearTiempoRestante(pedido.expiraEn);
                return (
                  <label
                    key={pid}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                      checked
                        ? "border-indigo-400 bg-indigo-50/50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setRutaActivaId(null);
                        toggleSeleccionPedido(pid);
                      }}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {pedido.codigo}
                        </span>
                        {pedido.esParcial && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                            Parcial
                          </span>
                        )}
                        {(pedido.intentosEntrega ?? 0) > 0 && (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800">
                            Intento {pedido.intentosEntrega}/{maxIntentos}
                          </span>
                        )}
                        <span
                          className={`ml-auto text-[11px] font-medium ${
                            vence.urgente ? "text-rose-700" : "text-slate-500"
                          }`}
                        >
                          {vence.texto}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs font-semibold text-slate-800">
                        {pedido.pacienteNombre}{" "}
                        {pedido.pacienteTelefono
                          ? `· ${pedido.pacienteTelefono}`
                          : ""}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-600">
                        {pedido.direccionEntrega}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {/* Selector de domiciliario y botón generar */}
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div>
              <label
                htmlFor="select-domiciliario"
                className="block text-xs font-semibold text-slate-700"
              >
                Domiciliario asignado
              </label>
              <select
                id="select-domiciliario"
                value={domiciliarioId}
                onChange={(e) => setDomiciliarioId(e.target.value)}
                disabled={domiciliarios.length === 0}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                {domiciliarios.length === 0 ? (
                  <option value="">
                    No hay domiciliarios activos en esta sede
                  </option>
                ) : (
                  domiciliarios.map((d) => (
                    <option key={d.usuarioId} value={d.usuarioId}>
                      {d.nombres} {d.apellidos}
                    </option>
                  ))
                )}
              </select>
            </div>

            <button
              type="button"
              onClick={() => void generarRuta()}
              disabled={
                creandoRuta ||
                seleccionadosIds.length === 0 ||
                !domiciliarioId
              }
              className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creandoRuta
                ? "Calculando ruta optimizada…"
                : `Generar ruta (${seleccionadosIds.length} parada${
                    seleccionadosIds.length === 1 ? "" : "s"
                  })`}
            </button>
          </div>
        </section>

        {/* Columna derecha: Rutas del día + detalle, reorden e inicio (RF-EMP-21) */}
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-6">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Rutas del {fechaRutas} ({rutas.length})
              </h2>
              <p className="text-xs text-slate-500">
                Selecciona una ruta para verla en el mapa, reordenar paradas o
                iniciarla.
              </p>
            </div>
          </div>

          {rutas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
              No hay rutas registradas para el {fechaRutas}.
            </div>
          ) : (
            <div className="space-y-2">
              {rutas.map((ruta) => {
                const seleccionada = ruta.id === rutaActivaId;
                const est = (ruta.estado ?? "PLANEADA") as EstadoRuta;
                const entregadas = (ruta.paradas ?? []).filter(
                  (p) => p.estado === "ENTREGADA"
                ).length;
                const fallidas = (ruta.paradas ?? []).filter(
                  (p) => p.estado === "FALLIDA"
                ).length;
                const total = ruta.paradas?.length ?? 0;

                return (
                  <button
                    key={ruta.id}
                    type="button"
                    onClick={() =>
                      setRutaActivaId(seleccionada ? null : (ruta.id ?? null))
                    }
                    className={`w-full rounded-xl border p-3.5 text-left transition ${
                      seleccionada
                        ? "border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-300"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {ruta.domiciliarioNombre ?? "Domiciliario"}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${CLASE_ESTADO_RUTA[est]}`}
                      >
                        {ETIQUETA_ESTADO_RUTA[est]}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                      <span>
                        <strong>{total}</strong> parada{total === 1 ? "" : "s"}
                      </span>
                      <span>
                        Distancia:{" "}
                        <strong>{formatearDistanciaKm(ruta.distanciaKm)}</strong>
                      </span>
                      <span>
                        Resueltas: {entregadas} ok / {fallidas} fallida
                        {fallidas === 1 ? "" : "s"}
                      </span>
                      <span className="ml-auto text-[11px] text-slate-400">
                        {formatearFechaHora(ruta.createdAt)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Detalle de la ruta seleccionada */}
          {rutaActiva && (
            <div className="space-y-3 border-t border-slate-200 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Paradas de la ruta ({paradasEditables.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Distancia total estimada:{" "}
                    <strong>
                      {formatearDistanciaKm(rutaActiva.distanciaKm)}
                    </strong>{" "}
                    (línea recta)
                  </p>
                </div>

                {rutaActiva.estado === "PLANEADA" && (
                  <div className="flex flex-wrap gap-2">
                    {ordenModificado && (
                      <button
                        type="button"
                        onClick={() => void guardarNuevoOrden()}
                        disabled={guardandoOrden}
                        className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
                      >
                        {guardandoOrden ? "Guardando…" : "Guardar orden"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setModalIniciarAbierto(true)}
                      disabled={ordenModificado || guardandoOrden}
                      title={
                        ordenModificado
                          ? "Guarda el nuevo orden antes de iniciar la ruta"
                          : "Iniciar ruta y despachar pedidos"
                      }
                      className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Iniciar ruta
                    </button>
                  </div>
                )}
              </div>

              {rutaActiva.estado === "PLANEADA" && ordenModificado && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Has reordenado paradas. Pulsa <strong>Guardar orden</strong>{" "}
                  para recalcular las distancias antes de iniciar la ruta.
                </p>
              )}

              <ol className="space-y-2">
                {paradasEditables.map((parada, idx) => {
                  const estParada = (parada.estado ??
                    "PENDIENTE") as EstadoRutaParada;
                  const estPedido = parada.estadoPedido as
                    | EstadoPedido
                    | undefined;
                  return (
                    <li
                      key={parada.id ?? idx}
                      className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                        {parada.orden}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Link
                            href={`/pedidos/${parada.pedidoId}`}
                            className="font-mono text-xs font-bold text-emerald-800 hover:underline"
                          >
                            {parada.pedidoCodigo}
                          </Link>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CLASE_ESTADO_PARADA[estParada]}`}
                          >
                            {ETIQUETA_ESTADO_PARADA[estParada]}
                          </span>
                          {estPedido && (
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CLASE_ESTADO_PEDIDO[estPedido]}`}
                            >
                              {ETIQUETA_ESTADO_PEDIDO[estPedido]}
                            </span>
                          )}
                          <span className="ml-auto text-[11px] text-slate-500">
                            +{formatearDistanciaKm(
                              parada.distanciaKmDesdeAnterior
                            )}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs font-semibold text-slate-800">
                          {parada.pacienteNombre}
                        </p>
                        <p className="text-xs text-slate-600">
                          {parada.direccionEntrega}
                        </p>
                      </div>

                      {rutaActiva.estado === "PLANEADA" && (
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            aria-label={`Subir parada ${parada.orden}`}
                            disabled={idx === 0 || guardandoOrden}
                            onClick={() => moverParada(idx, -1)}
                            className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-35"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            aria-label={`Bajar parada ${parada.orden}`}
                            disabled={
                              idx === paradasEditables.length - 1 ||
                              guardandoOrden
                            }
                            onClick={() => moverParada(idx, 1)}
                            className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-35"
                          >
                            ↓
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </section>
      </div>

      {/* Modal confirmar inicio de ruta */}
      <Modal
        abierto={modalIniciarAbierto}
        titulo="Iniciar ruta de domicilio"
        descripcion="Al iniciar la ruta, todos los pedidos pasarán a estado En ruta y los pacientes recibirán una notificación."
        onCerrar={() => !iniciandoRuta && setModalIniciarAbierto(false)}
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
            <p>
              <strong>Domiciliario:</strong>{" "}
              {rutaActiva?.domiciliarioNombre ?? "—"}
            </p>
            <p className="mt-1">
              <strong>Paradas:</strong> {rutaActiva?.paradas?.length ?? 0} ·{" "}
              <strong>Distancia estimada:</strong>{" "}
              {formatearDistanciaKm(rutaActiva?.distanciaKm)}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={iniciandoRuta}
              onClick={() => setModalIniciarAbierto(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={iniciandoRuta}
              onClick={() => void confirmarIniciarRuta()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {iniciandoRuta ? "Iniciando…" : "Confirmar e iniciar ruta"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function DomiciliosPage() {
  return (
    <RoleGuard
      permitido={puedeArmarRutas}
      mensajeDenegado="Solo el farmacéutico o un administrador pueden planear e iniciar rutas de domicilio."
    >
      <DomiciliosContenido />
    </RoleGuard>
  );
}
