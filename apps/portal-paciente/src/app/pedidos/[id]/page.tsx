"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { Modal } from "@/components/Modal";
import { PacienteGuard } from "@/components/PacienteGuard";
import { portalApi, type PedidoDetalle } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import {
  CLASE_ESTADO_ITEM,
  CLASE_ESTADO_PEDIDO,
  CLASE_ESTADO_TURNO,
  ETIQUETA_ESTADO_ITEM,
  ETIQUETA_ESTADO_PARADA,
  ETIQUETA_ESTADO_PEDIDO,
  ETIQUETA_ESTADO_RUTA,
  ETIQUETA_ESTADO_TURNO,
  ETIQUETA_MODALIDAD,
  esEstadoPedidoActivo,
  formatearFecha,
  formatearFechaHora,
  formatearHora,
  formatearTiempoRestante,
  puedeCancelarPedidoPaciente,
  type EstadoItemPedido,
  type EstadoPedido,
  type EstadoTurno,
  type ModalidadPedido,
} from "@/lib/format";

const PASOS_RECOGER: EstadoPedido[] = [
  "RESERVADO",
  "EN_PREPARACION",
  "LISTO",
  "ENTREGADO",
];

const PASOS_DOMICILIO: EstadoPedido[] = [
  "RESERVADO",
  "EN_PREPARACION",
  "LISTO",
  "EN_RUTA",
  "ENTREGADO",
];

function ContenidoDetallePedido() {
  const params = useParams<{ id: string }>();
  const pedidoId = params?.id ?? "";
  const { sesion, refrescarNotificaciones, mostrarExito } = useApp();
  const token = sesion?.accessToken ?? "";

  const [pedido, setPedido] = useState<PedidoDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [noEncontrado, setNoEncontrado] = useState(false);

  const [modalCancelar, setModalCancelar] = useState(false);
  const [notaCancelacion, setNotaCancelacion] = useState("");
  const [cancelando, setCancelando] = useState(false);
  const [errorCancelar, setErrorCancelar] = useState<string | null>(null);

  const cargarDetalle = useCallback(async () => {
    if (!token || !pedidoId) return;
    setCargando(true);
    setNoEncontrado(false);
    try {
      const data = await portalApi.obtenerDetallePedido(pedidoId, {
        token,
        notifyGlobalError: false,
      });
      setPedido(data);
    } catch (err) {
      if (isApiError(err) && err.status === 404) {
        setNoEncontrado(true);
      }
      setPedido(null);
    } finally {
      setCargando(false);
    }
  }, [token, pedidoId]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void cargarDetalle();
    }, 0);
    return () => window.clearTimeout(id);
  }, [cargarDetalle]);

  const manejarCancelar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !pedido?.id) return;
    setCancelando(true);
    setErrorCancelar(null);
    try {
      const actualizado = await portalApi.cancelarPedido(
        pedido.id,
        notaCancelacion.trim() ? { nota: notaCancelacion.trim() } : {},
        { token, notifyGlobalError: false }
      );
      setPedido(actualizado);
      setModalCancelar(false);
      setNotaCancelacion("");
      await refrescarNotificaciones();
      mostrarExito(
        "Pedido cancelado",
        pedido.modalidad === "DOMICILIO"
          ? "La reserva fue liberada correctamente."
          : "La reserva fue liberada y tu turno pasó a estado cancelado."
      );
    } catch (err) {
      setErrorCancelar(
        isApiError(err)
          ? err.mensajeUsuario
          : "No fue posible cancelar el pedido."
      );
    } finally {
      setCancelando(false);
    }
  };

  if (cargando) {
    return (
      <div className="space-y-4">
        <div className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        <div className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      </div>
    );
  }

  if (noEncontrado || !pedido) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-lg font-bold text-slate-900">
          Pedido no encontrado
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          No existe un pedido con este identificador asociado a tu cuenta.
        </p>
        <Link
          href="/pedidos"
          className="mt-4 inline-flex rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
        >
          Volver a mis pedidos
        </Link>
      </div>
    );
  }

  const estado = (pedido.estado ?? "RESERVADO") as EstadoPedido;
  const modalidad = (pedido.modalidad ?? "RECOGER") as ModalidadPedido;
  const activo = esEstadoPedidoActivo(estado);
  const puedeCancelar = puedeCancelarPedidoPaciente(estado);
  const tiempoRestante = formatearTiempoRestante(pedido.expiraEn);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/pedidos"
          className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800"
        >
          ← Volver a mis pedidos
        </Link>
        <button
          type="button"
          onClick={() => void cargarDetalle()}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Actualizar estado
        </button>
      </div>

      {/* Resumen del pedido */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-xl font-bold text-slate-900">
                {pedido.codigo}
              </h1>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${CLASE_ESTADO_PEDIDO[estado]}`}
              >
                {ETIQUETA_ESTADO_PEDIDO[estado]}
              </span>
              {pedido.esParcial && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                  Pedido parcial
                </span>
              )}
            </div>

            <div className="mt-2 space-y-1 text-xs text-slate-600">
              <p>
                <span className="font-semibold text-slate-800">Sede:</span>{" "}
                {pedido.sedeNombre} ({pedido.sedeCodigo}) ·{" "}
                {ETIQUETA_MODALIDAD[modalidad]}
              </p>
              <p>
                <span className="font-semibold text-slate-800">Fórmula:</span>{" "}
                {pedido.formulaId ? (
                  <Link
                    href={`/formulas/${pedido.formulaId}`}
                    className="font-mono font-semibold text-teal-700 hover:underline"
                  >
                    {pedido.formulaCodigo}
                  </Link>
                ) : (
                  <span className="font-mono">{pedido.formulaCodigo}</span>
                )}
              </p>
              <p>
                <span className="font-semibold text-slate-800">
                  Hora límite de la reserva:
                </span>{" "}
                {formatearFechaHora(pedido.expiraEn)}{" "}
                {activo && (
                  <span
                    className={`ml-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      tiempoRestante.urgente
                        ? "bg-rose-100 text-rose-800"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {tiempoRestante.texto}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {puedeCancelar && (
              <button
                type="button"
                onClick={() => {
                  setErrorCancelar(null);
                  setModalCancelar(true);
                }}
                className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 sm:text-sm"
              >
                Cancelar pedido
              </button>
            )}
            {estado === "VENCIDO" && pedido.formulaId && (
              <Link
                href={`/pedidos/nuevo?formulaId=${encodeURIComponent(
                  pedido.formulaId
                )}`}
                className="rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-teal-800 sm:text-sm"
              >
                Crear pedido nuevo
              </Link>
            )}
          </div>
        </div>

        {estado === "EN_RUTA" && (
          <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-3.5 text-xs text-indigo-950">
            <p className="font-bold">Tu pedido está En ruta</p>
            <p className="mt-0.5">
              {pedido.ruta?.domiciliarioNombre
                ? `${pedido.ruta.domiciliarioNombre} va en camino a tu dirección`
                : "Nuestro domiciliario va en camino a tu dirección"}
              {pedido.ruta?.orden ? ` (parada #${pedido.ruta.orden})` : ""}. No
              es posible cancelar un pedido que ya está en ruta.
            </p>
          </div>
        )}

        {estado === "VENCIDO" && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            El tiempo límite de esta reserva venció y el stock fue liberado. Si
            tu fórmula sigue vigente con saldo pendiente, puedes crear un pedido
            nuevo.
          </div>
        )}

        {/* Seguimiento visual por pasos (incluye EN_RUTA para DOMICILIO) */}
        {estado !== "CANCELADO" && estado !== "VENCIDO" && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <ol className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-between">
              {(modalidad === "DOMICILIO" ? PASOS_DOMICILIO : PASOS_RECOGER).map(
                (paso, idx, arr) => {
                  const indiceActual = arr.indexOf(estado);
                  const completado = idx < indiceActual;
                  const actual = idx === indiceActual;
                  return (
                    <li
                      key={paso}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold sm:flex-1 ${
                        actual
                          ? paso === "EN_RUTA"
                            ? "border-indigo-400 bg-indigo-50 text-indigo-900"
                            : "border-teal-500 bg-teal-50 text-teal-900"
                          : completado
                            ? "border-emerald-200 bg-emerald-50/50 text-emerald-800"
                            : "border-slate-200 bg-slate-50 text-slate-400"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                          actual
                            ? paso === "EN_RUTA"
                              ? "bg-indigo-600 text-white"
                              : "bg-teal-700 text-white"
                            : completado
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        {completado ? "✓" : idx + 1}
                      </span>
                      <span className="truncate">
                        {ETIQUETA_ESTADO_PEDIDO[paso]}
                      </span>
                    </li>
                  );
                }
              )}
            </ol>
          </div>
        )}
      </section>

      {/* Tarjeta de domicilio y ruta (RF-PAC-12, RF-PAC-14, CA-PAC-10) */}
      {modalidad === "DOMICILIO" && (
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold tracking-wide text-indigo-800 uppercase">
                Entrega a domicilio
              </p>
              <p className="text-sm font-bold text-slate-900">
                {pedido.direccionEntrega || "Dirección registrada"}
              </p>
              {typeof pedido.latitudEntrega === "number" &&
                typeof pedido.longitudEntrega === "number" && (
                  <p className="font-mono text-[11px] text-slate-600">
                    Ubicación: {pedido.latitudEntrega.toFixed(6)},{" "}
                    {pedido.longitudEntrega.toFixed(6)}
                  </p>
                )}
              {(pedido.intentosEntrega ?? 0) > 0 && (
                <p className="text-xs text-amber-900">
                  Intentos de entrega registrados:{" "}
                  <strong>{pedido.intentosEntrega}</strong>
                </p>
              )}
              {pedido.ruta && (
                <div className="mt-2 rounded-xl border border-indigo-200/80 bg-white/80 p-3 text-xs text-slate-700">
                  <p className="font-semibold text-indigo-950">
                    {pedido.ruta.estadoRuta
                      ? ETIQUETA_ESTADO_RUTA[pedido.ruta.estadoRuta]
                      : "Ruta asignada"}
                    {pedido.ruta.orden ? ` · Parada #${pedido.ruta.orden}` : ""}
                  </p>
                  {pedido.ruta.domiciliarioNombre && (
                    <p className="mt-0.5">
                      Domiciliario:{" "}
                      <strong>{pedido.ruta.domiciliarioNombre}</strong>
                    </p>
                  )}
                  <p className="mt-0.5 text-slate-500">
                    Fecha: {formatearFecha(pedido.ruta.fecha)}
                    {pedido.ruta.estadoParada
                      ? ` · Parada: ${ETIQUETA_ESTADO_PARADA[pedido.ruta.estadoParada]}`
                      : ""}
                  </p>
                </div>
              )}
            </div>

            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${CLASE_ESTADO_PEDIDO[estado]}`}
            >
              {ETIQUETA_ESTADO_PEDIDO[estado]}
            </span>
          </div>
        </section>
      )}

      {/* Tarjeta de turno (RF-PAC-11, RF-PAC-14) */}
      {pedido.turno && (
        <section className="rounded-2xl border border-teal-200 bg-teal-50/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-wide text-teal-800 uppercase">
                Turno para recoger en sede
              </p>
              <p className="mt-1 font-mono text-3xl font-extrabold tracking-tight text-teal-950">
                {pedido.turno.codigo}
              </p>
              <p className="mt-1 text-xs text-teal-900">
                Fecha: <strong>{formatearFecha(pedido.turno.fecha)}</strong> ·
                Franja desde:{" "}
                <strong>{formatearHora(pedido.turno.franjaInicio)}</strong>
              </p>
              {pedido.turno.llamadoEn && (
                <p className="mt-0.5 text-xs text-teal-800">
                  Llamado: {formatearFechaHora(pedido.turno.llamadoEn)}
                </p>
              )}
              {pedido.turno.atendidoEn && (
                <p className="mt-0.5 text-xs text-teal-800">
                  Atendido: {formatearFechaHora(pedido.turno.atendidoEn)}
                </p>
              )}
            </div>

            {pedido.turno.estado && (
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  CLASE_ESTADO_TURNO[pedido.turno.estado as EstadoTurno]
                }`}
              >
                {ETIQUETA_ESTADO_TURNO[pedido.turno.estado as EstadoTurno]}
              </span>
            )}
          </div>
        </section>
      )}

      {/* Ítems del pedido (RF-PAC-14) */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-slate-900">
          Medicamentos del pedido
        </h2>
        <div className="space-y-2.5">
          {(pedido.items ?? []).map((item) => {
            const estItem = (item.estadoItem ?? "COMPLETO") as EstadoItemPedido;
            return (
              <div
                key={item.id ?? item.medicamentoId}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {item.medicamentoNombre}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.medicamentoCodigo} · {item.presentacion}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${CLASE_ESTADO_ITEM[estItem]}`}
                  >
                    {ETIQUETA_ESTADO_ITEM[estItem]}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center text-xs">
                  <div className="rounded-lg bg-slate-50 py-1.5">
                    <p className="text-[11px] text-slate-500">Solicitado</p>
                    <p className="font-bold text-slate-900">
                      {item.cantidadSolicitada ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 py-1.5">
                    <p className="text-[11px] text-slate-500">Reservado</p>
                    <p className="font-bold text-teal-800">
                      {item.cantidadReservada ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 py-1.5">
                    <p className="text-[11px] text-slate-500">Entregado</p>
                    <p className="font-bold text-emerald-800">
                      {item.cantidadEntregada ?? 0}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Línea de tiempo de estados (RF-PAC-14) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="text-base font-bold text-slate-900">
          Línea de tiempo del pedido
        </h2>

        {!pedido.historial || pedido.historial.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">
            No hay registros en el historial todavía.
          </p>
        ) : (
          <ol className="mt-4 space-y-4 border-l-2 border-teal-200 pl-4">
            {pedido.historial.map((evento, idx) => {
              const nuevo = evento.estadoNuevo as EstadoPedido | undefined;
              const anterior = evento.estadoAnterior as EstadoPedido | undefined;
              return (
                <li key={evento.id ?? idx} className="relative">
                  <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-white bg-teal-600 shadow-xs" />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">
                      {nuevo ? ETIQUETA_ESTADO_PEDIDO[nuevo] ?? nuevo : "Cambio"}
                    </span>
                    {anterior && (
                      <span className="text-xs text-slate-500">
                        (desde {ETIQUETA_ESTADO_PEDIDO[anterior] ?? anterior})
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {formatearFechaHora(evento.createdAt)}
                  </p>
                  {evento.nota && (
                    <p className="mt-1 rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
                      {evento.nota}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* Modal confirmar cancelación (RF-PAC-15, RN-PAC-06, CA-PAC-08) */}
      <Modal
        abierto={modalCancelar}
        titulo="Cancelar pedido"
        descripcion={
          modalidad === "DOMICILIO"
            ? "Al cancelar, las unidades reservadas se liberarán inmediatamente."
            : "Al cancelar, las unidades reservadas se liberarán inmediatamente y tu turno quedará cancelado."
        }
        onCerrar={() => setModalCancelar(false)}
      >
        <form onSubmit={manejarCancelar} className="space-y-4">
          {errorCancelar && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-900"
            >
              {errorCancelar}
            </div>
          )}

          <div>
            <label
              htmlFor="nota-cancelar"
              className="block text-xs font-semibold text-slate-700"
            >
              Motivo o nota (opcional)
            </label>
            <textarea
              id="nota-cancelar"
              rows={3}
              maxLength={500}
              value={notaCancelacion}
              onChange={(e) => setNotaCancelacion(e.target.value)}
              placeholder="Ej. No podré asistir en esta franja horaria."
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setModalCancelar(false)}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Mantener pedido
            </button>
            <button
              type="submit"
              disabled={cancelando}
              className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-60"
            >
              {cancelando ? "Cancelando…" : "Sí, cancelar pedido"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function DetallePedidoPage() {
  return (
    <PacienteGuard>
      <ContenidoDetallePedido />
    </PacienteGuard>
  );
}
