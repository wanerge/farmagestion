"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Modal } from "@/components/Modal";
import { RoleGuard } from "@/components/RoleGuard";
import {
  farmaApi,
  type EstadoPedido,
  type EstadoRuta,
  type EstadoRutaParada,
  type RutaDetalle,
  type RutaParada,
} from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import { puedeEjecutarRutas } from "@/lib/auth/permisos";
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
} from "@/lib/format";

const MapaRutaLeaflet = dynamic(
  () => import("@/components/MapaRutaLeaflet"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-80 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-xs text-slate-500">
        Cargando mapa de tu ruta…
      </div>
    ),
  }
);

type ModalAccionParada =
  | { tipo: "entregar"; rutaId: string; parada: RutaParada }
  | { tipo: "fallida"; rutaId: string; parada: RutaParada }
  | null;

function MiRutaContenido() {
  const { sesion, mostrarExito, refrescarNotificaciones } = useApp();
  const token = sesion?.accessToken ?? "";

  const [fecha, setFecha] = useState<string>(() => fechaHoyBogota());
  const [rutas, setRutas] = useState<RutaDetalle[]>([]);
  const [rutaSeleccionadaId, setRutaSeleccionadaId] = useState<string | null>(
    null
  );
  const [cargando, setCargando] = useState(true);

  const [modalAccion, setModalAccion] = useState<ModalAccionParada>(null);
  const [textoAccion, setTextoAccion] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  const cargarMisRutas = useCallback(async () => {
    if (!token) return;
    setCargando(true);
    try {
      const lista = await farmaApi.listarMisRutas({ fecha }, { token });
      setRutas(lista);
      setRutaSeleccionadaId((prev) => {
        if (prev && lista.some((r) => r.id === prev)) return prev;
        const enCurso = lista.find((r) => r.estado === "EN_CURSO");
        return enCurso?.id ?? lista[0]?.id ?? null;
      });
    } catch {
      // Manejado por el interceptor global
    } finally {
      setCargando(false);
    }
  }, [token, fecha]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void cargarMisRutas();
    }, 0);
    return () => window.clearTimeout(id);
  }, [cargarMisRutas]);

  const rutaActual = useMemo(
    () => rutas.find((r) => r.id === rutaSeleccionadaId) ?? rutas[0] ?? null,
    [rutas, rutaSeleccionadaId]
  );

  const paradasOrdenadas = useMemo(
    () =>
      [...(rutaActual?.paradas ?? [])].sort(
        (a, b) => (a.orden ?? 0) - (b.orden ?? 0)
      ),
    [rutaActual]
  );

  const abrirModal = (
    tipo: "entregar" | "fallida",
    rutaId: string,
    parada: RutaParada
  ) => {
    setModalAccion({ tipo, rutaId, parada });
    setTextoAccion("");
    setErrorModal(null);
  };

  const cerrarModal = () => {
    if (procesando) return;
    setModalAccion(null);
    setErrorModal(null);
  };

  const ejecutarAccionParada = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !modalAccion || !modalAccion.parada.id) return;

    setErrorModal(null);

    if (modalAccion.tipo === "fallida" && !textoAccion.trim()) {
      setErrorModal("Debes escribir el motivo de la entrega fallida.");
      return;
    }

    setProcesando(true);
    try {
      let actualizada: RutaDetalle;
      if (modalAccion.tipo === "entregar") {
        actualizada = await farmaApi.marcarParadaEntregada(
          modalAccion.rutaId,
          modalAccion.parada.id,
          textoAccion.trim() ? { nota: textoAccion.trim() } : {},
          { token, notifyGlobalError: false }
        );
        mostrarExito(
          "Parada entregada",
          `Pedido ${modalAccion.parada.pedidoCodigo} entregado y dispensado.${
            actualizada.estado === "COMPLETADA"
              ? " ¡Ruta completada!"
              : ""
          }`
        );
      } else {
        actualizada = await farmaApi.marcarParadaFallida(
          modalAccion.rutaId,
          modalAccion.parada.id,
          { motivo: textoAccion.trim() },
          { token, notifyGlobalError: false }
        );
        const paradaActualizada = actualizada.paradas?.find(
          (p) => p.id === modalAccion.parada.id
        );
        const cancelado = paradaActualizada?.estadoPedido === "CANCELADO";
        mostrarExito(
          cancelado ? "Pedido cancelado por intentos agotados" : "Entrega fallida registrada",
          cancelado
            ? `El pedido ${modalAccion.parada.pedidoCodigo} agotó sus intentos de entrega y fue cancelado con liberación de stock.`
            : `El pedido ${modalAccion.parada.pedidoCodigo} regresó a estado Listo para reprogramación.`
        );
      }

      setRutas((prev) =>
        prev.map((r) => (r.id === actualizada.id ? actualizada : r))
      );
      setModalAccion(null);
      await refrescarNotificaciones();
    } catch (err) {
      setErrorModal(
        isApiError(err)
          ? err.mensajeUsuario
          : "No fue posible registrar el resultado de la parada."
      );
    } finally {
      setProcesando(false);
    }
  };

  const resueltas = paradasOrdenadas.filter(
    (p) => p.estado !== "PENDIENTE"
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Mi ruta de entregas
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Consulta tus paradas en orden, visualízalas en el mapa y registra
            cada entrega o novedad.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            aria-label="Fecha de mi ruta"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
          />
          <button
            type="button"
            onClick={() => void cargarMisRutas()}
            disabled={cargando}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            {cargando ? "Cargando…" : "Actualizar"}
          </button>
        </div>
      </div>

      {cargando ? (
        <div className="space-y-4">
          <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          <div className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        </div>
      ) : rutas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-base font-bold text-slate-900">
            No tienes rutas asignadas para el {fecha}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Cuando el farmacéutico de tu sede arme y te asigne una ruta, la
            verás aquí automáticamente.
          </p>
        </div>
      ) : (
        <>
          {/* Selector de rutas si hay más de una en el día */}
          {rutas.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {rutas.map((r, idx) => {
                const activa = r.id === rutaActual?.id;
                const est = (r.estado ?? "PLANEADA") as EstadoRuta;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRutaSeleccionadaId(r.id ?? null)}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                      activa
                        ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span>Ruta #{rutas.length - idx}</span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] ${CLASE_ESTADO_RUTA[est]}`}
                    >
                      {ETIQUETA_ESTADO_RUTA[est]}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {rutaActual && (
            <>
              {/* Resumen de la ruta actual */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900">
                        {rutaActual.sedeNombre} ({rutaActual.sedeCodigo})
                      </h2>
                      {rutaActual.estado && (
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                            CLASE_ESTADO_RUTA[rutaActual.estado as EstadoRuta]
                          }`}
                        >
                          {ETIQUETA_ESTADO_RUTA[rutaActual.estado as EstadoRuta]}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      Progreso: <strong>{resueltas}</strong> de{" "}
                      <strong>{paradasOrdenadas.length}</strong> paradas
                      resueltas · Distancia total estimada:{" "}
                      <strong>
                        {formatearDistanciaKm(rutaActual.distanciaKm)}
                      </strong>{" "}
                      (línea recta) · Creada{" "}
                      {formatearFechaHora(rutaActual.createdAt)}
                    </p>
                  </div>
                </div>

                {rutaActual.estado === "PLANEADA" && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-900">
                    Esta ruta aún está en estado <strong>Planeada</strong>.
                    Podrás marcar entregas cuando el farmacéutico la inicie.
                  </div>
                )}

                {rutaActual.estado === "COMPLETADA" && (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-900">
                    Todas las paradas de esta ruta fueron resueltas. ¡Ruta
                    completada!
                  </div>
                )}

                <div className="mt-4">
                  <MapaRutaLeaflet
                    origen={{
                      nombre: rutaActual.sedeNombre,
                      codigo: rutaActual.sedeCodigo,
                      direccion: rutaActual.sedeDireccion,
                      latitud: rutaActual.sedeLatitud,
                      longitud: rutaActual.sedeLongitud,
                    }}
                    paradas={paradasOrdenadas}
                    alturaClase="h-72 sm:h-96"
                  />
                </div>
              </section>

              {/* Lista de paradas en orden */}
              <section className="space-y-3">
                <h2 className="text-base font-bold text-slate-900">
                  Paradas en orden ({paradasOrdenadas.length})
                </h2>

                <ol className="space-y-3">
                  {paradasOrdenadas.map((parada) => {
                    const estParada = (parada.estado ??
                      "PENDIENTE") as EstadoRutaParada;
                    const estPedido = parada.estadoPedido as
                      | EstadoPedido
                      | undefined;
                    const puedeOperar =
                      rutaActual.estado === "EN_CURSO" &&
                      estParada === "PENDIENTE";

                    return (
                      <li
                        key={parada.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex items-start gap-3">
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white ${
                                estParada === "ENTREGADA"
                                  ? "bg-emerald-600"
                                  : estParada === "FALLIDA"
                                    ? "bg-rose-600"
                                    : "bg-indigo-600"
                              }`}
                            >
                              {parada.orden}
                            </span>

                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-sm font-bold text-slate-900">
                                  {parada.pedidoCodigo}
                                </span>
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${CLASE_ESTADO_PARADA[estParada]}`}
                                >
                                  {ETIQUETA_ESTADO_PARADA[estParada]}
                                </span>
                                {estPedido && (
                                  <span
                                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${CLASE_ESTADO_PEDIDO[estPedido]}`}
                                  >
                                    Pedido: {ETIQUETA_ESTADO_PEDIDO[estPedido]}
                                  </span>
                                )}
                                {parada.esParcial && (
                                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                                    Pedido parcial
                                  </span>
                                )}
                              </div>

                              <p className="text-sm font-semibold text-slate-800">
                                {parada.pacienteNombre}{" "}
                                {parada.pacienteDocumento
                                  ? `· Doc. ${parada.pacienteDocumento}`
                                  : ""}
                              </p>
                              <p className="text-xs text-slate-700">
                                <strong>Dirección:</strong>{" "}
                                {parada.direccionEntrega}
                              </p>
                              <p className="text-xs text-slate-500">
                                {parada.pacienteTelefono
                                  ? `Teléfono: ${parada.pacienteTelefono} · `
                                  : ""}
                                Tramo desde anterior:{" "}
                                <strong>
                                  {formatearDistanciaKm(
                                    parada.distanciaKmDesdeAnterior
                                  )}
                                </strong>
                                {(parada.intentosEntrega ?? 0) > 0
                                  ? ` · Intentos fallidos acumulados: ${parada.intentosEntrega}`
                                  : ""}
                              </p>
                            </div>
                          </div>

                          {puedeOperar && rutaActual.id && (
                            <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col">
                              <button
                                type="button"
                                onClick={() =>
                                  abrirModal(
                                    "entregar",
                                    rutaActual.id!,
                                    parada
                                  )
                                }
                                className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                              >
                                Marcar entregada
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  abrirModal("fallida", rutaActual.id!, parada)
                                }
                                className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100"
                              >
                                Marcar fallida
                              </button>
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            </>
          )}
        </>
      )}

      {/* Modal confirmar entrega o fallo */}
      <Modal
        abierto={modalAccion !== null}
        titulo={
          modalAccion?.tipo === "entregar"
            ? `Entregar ${modalAccion.parada.pedidoCodigo ?? "parada"}`
            : `Reportar entrega fallida · ${
                modalAccion?.parada.pedidoCodigo ?? ""
              }`
        }
        descripcion={
          modalAccion?.tipo === "entregar"
            ? "Confirma la entrega de los medicamentos al paciente. Se registrará la dispensación en el inventario."
            : "Registra el motivo de la novedad. Si es el último intento permitido, el pedido se cancelará y liberará el stock."
        }
        onCerrar={cerrarModal}
      >
        <form onSubmit={ejecutarAccionParada} className="space-y-4">
          {errorModal && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-900"
            >
              {errorModal}
            </div>
          )}

          <div>
            <label
              htmlFor="texto-parada"
              className="block text-xs font-semibold text-slate-700"
            >
              {modalAccion?.tipo === "entregar"
                ? "Nota de entrega (opcional)"
                : "Motivo de la entrega fallida (obligatorio)"}
            </label>
            <textarea
              id="texto-parada"
              rows={3}
              maxLength={500}
              required={modalAccion?.tipo === "fallida"}
              value={textoAccion}
              onChange={(e) => setTextoAccion(e.target.value)}
              placeholder={
                modalAccion?.tipo === "entregar"
                  ? "Ej. Entregado directamente al paciente."
                  : "Ej. Nadie atendió en la dirección después de 15 minutos."
              }
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={procesando}
              onClick={cerrarModal}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={procesando}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                modalAccion?.tipo === "entregar"
                  ? "bg-emerald-700 hover:bg-emerald-800"
                  : "bg-rose-600 hover:bg-rose-700"
              }`}
            >
              {procesando
                ? "Guardando…"
                : modalAccion?.tipo === "entregar"
                  ? "Confirmar entrega"
                  : "Confirmar parada fallida"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function MiRutaPage() {
  return (
    <RoleGuard
      permitido={puedeEjecutarRutas}
      mensajeDenegado="La vista 'Mi ruta' es exclusiva para empleados con cargo Domiciliario."
    >
      <MiRutaContenido />
    </RoleGuard>
  );
}
