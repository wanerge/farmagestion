"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Modal } from "@/components/Modal";
import { RoleGuard } from "@/components/RoleGuard";
import {
  farmaApi,
  type PedidoDetalle,
  type PedidoItem,
} from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import {
  calcularAccionesPedido,
  esAdmin,
  puedeGestionarPedidosYTurnos,
} from "@/lib/auth/permisos";
import {
  acortarUuid,
  CLASE_ESTADO_PEDIDO,
  CLASE_ESTADO_TURNO,
  ETIQUETA_ESTADO_PEDIDO,
  ETIQUETA_ESTADO_TURNO,
  ETIQUETA_MODALIDAD,
  formatearFechaHora,
  formatearHora,
  formatearTiempoRestante,
} from "@/lib/format";

type AccionModal = "tomar" | "listo" | "entregar" | "cancelar" | "faltante";

function PedidoDetalleContenido() {
  const params = useParams<{ id: string }>();
  const { sesion, mostrarExito, refrescarNotificaciones } = useApp();

  const pedidoId = params.id;
  const [pedido, setPedido] = useState<PedidoDetalle | null>(null);
  const [cargando, setCargando] = useState(true);

  // Modales de acción
  const [modal, setModal] = useState<AccionModal | null>(null);
  const [itemFaltante, setItemFaltante] = useState<PedidoItem | null>(null);
  const [nota, setNota] = useState("");
  const [documentoVerificado, setDocumentoVerificado] = useState("");
  const [motivoCancelacion, setMotivoCancelacion] = useState("");
  const [cantidadFaltante, setCantidadFaltante] = useState("");
  const [motivoFaltante, setMotivoFaltante] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  const accessToken = sesion?.accessToken;

  const cargar = useCallback(async () => {
    if (!accessToken || !pedidoId) return;
    setCargando(true);
    try {
      const detalle = await farmaApi.obtenerPedido(pedidoId, {
        token: accessToken,
      });
      setPedido(detalle);
    } catch {
      // Manejado globalmente
    } finally {
      setCargando(false);
    }
  }, [accessToken, pedidoId]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void cargar();
    }, 0);
    return () => window.clearTimeout(id);
  }, [cargar]);

  function abrirModal(tipo: AccionModal, item?: PedidoItem) {
    setModal(tipo);
    setItemFaltante(item ?? null);
    setNota("");
    setDocumentoVerificado("");
    setMotivoCancelacion("");
    setCantidadFaltante("");
    setMotivoFaltante("");
    setErrorModal(null);
  }

  function cerrarModal() {
    if (procesando) return;
    setModal(null);
    setItemFaltante(null);
    setErrorModal(null);
  }

  async function ejecutarAccion(e: React.FormEvent) {
    e.preventDefault();
    if (!sesion?.accessToken || !pedido?.id || !modal) return;

    setErrorModal(null);

    if (modal === "tomar") {
      setProcesando(true);
      try {
        const actualizado = await farmaApi.tomarPedido(
          pedido.id,
          nota.trim() ? { nota: nota.trim() } : {},
          { token: sesion.accessToken }
        );
        setPedido(actualizado);
        setModal(null);
        mostrarExito(
          "Pedido tomado",
          `El pedido ${actualizado.codigo} pasó a En preparación.`
        );
      } catch (err) {
        setErrorModal(
          isApiError(err) ? err.mensajeUsuario : "No fue posible tomar el pedido."
        );
      } finally {
        setProcesando(false);
      }
      return;
    }

    if (modal === "listo") {
      setProcesando(true);
      try {
        const actualizado = await farmaApi.marcarPedidoListo(
          pedido.id,
          nota.trim() ? { nota: nota.trim() } : {},
          { token: sesion.accessToken }
        );
        setPedido(actualizado);
        setModal(null);
        mostrarExito(
          "Pedido marcado como LISTO",
          `El pedido ${actualizado.codigo} está listo para entrega.`
        );
      } catch (err) {
        setErrorModal(
          isApiError(err)
            ? err.mensajeUsuario
            : "No fue posible marcar el pedido como listo."
        );
      } finally {
        setProcesando(false);
      }
      return;
    }

    if (modal === "entregar") {
      if (!documentoVerificado.trim()) {
        setErrorModal(
          "Debes digitar el número de documento del paciente para confirmar la entrega (RN-EMP-02)."
        );
        return;
      }
      setProcesando(true);
      try {
        const actualizado = await farmaApi.entregarPedido(
          pedido.id,
          {
            documentoVerificado: documentoVerificado.trim(),
            nota: nota.trim() || undefined,
          },
          { token: sesion.accessToken }
        );
        setPedido(actualizado);
        setModal(null);
        mostrarExito(
          "Pedido entregado",
          `Dispensación registrada para ${actualizado.codigo} y evento enviado al outbox.`
        );
        await refrescarNotificaciones();
      } catch (err) {
        setErrorModal(
          isApiError(err) ? err.mensajeUsuario : "No fue posible entregar el pedido."
        );
      } finally {
        setProcesando(false);
      }
      return;
    }

    if (modal === "cancelar") {
      if (!motivoCancelacion.trim()) {
        setErrorModal("El motivo de cancelación es obligatorio (RF-EMP-12).");
        return;
      }
      setProcesando(true);
      try {
        const actualizado = await farmaApi.cancelarPedido(
          pedido.id,
          { motivo: motivoCancelacion.trim() },
          { token: sesion.accessToken }
        );
        setPedido(actualizado);
        setModal(null);
        mostrarExito(
          "Pedido cancelado",
          `Se liberó el stock reservado del pedido ${actualizado.codigo}.`
        );
        await refrescarNotificaciones();
      } catch (err) {
        setErrorModal(
          isApiError(err)
            ? err.mensajeUsuario
            : "No fue posible cancelar el pedido."
        );
      } finally {
        setProcesando(false);
      }
      return;
    }

    if (modal === "faltante" && itemFaltante?.medicamentoId) {
      const unidades = Number.parseInt(cantidadFaltante, 10);
      if (!Number.isInteger(unidades) || unidades < 1) {
        setErrorModal("Ingresa cuántas unidades faltan en físico (entero >= 1).");
        return;
      }
      if (!motivoFaltante.trim()) {
        setErrorModal("El motivo del ajuste negativo es obligatorio (RF-EMP-13).");
        return;
      }
      setProcesando(true);
      try {
        await farmaApi.registrarAjuste(
          itemFaltante.medicamentoId,
          {
            cantidad: -Math.abs(unidades),
            motivo: motivoFaltante.trim(),
          },
          esAdmin(sesion.usuario) ? pedido.sedeId : undefined,
          { token: sesion.accessToken }
        );
        setModal(null);
        setItemFaltante(null);
        mostrarExito(
          "Ajuste por faltante aplicado",
          "El inventario y las reservas afectadas se actualizaron según RN-EMP-07."
        );
        await Promise.all([cargar(), refrescarNotificaciones()]);
      } catch (err) {
        setErrorModal(
          isApiError(err)
            ? err.mensajeUsuario
            : "No fue posible registrar el ajuste negativo."
        );
      } finally {
        setProcesando(false);
      }
    }
  }

  if (cargando && !pedido) {
    return (
      <div className="py-12 text-center text-sm text-slate-500">
        Cargando detalle del pedido…
      </div>
    );
  }

  if (!pedido) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-700">
          No se pudo cargar el pedido solicitado.
        </p>
        <Link
          href="/pedidos"
          className="mt-4 inline-block rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
        >
          Volver a la bandeja
        </Link>
      </div>
    );
  }

  const acciones = calcularAccionesPedido(sesion?.usuario, pedido);
  const urgencia = formatearTiempoRestante(pedido.expiraEn);
  const esActivo =
    pedido.estado === "RESERVADO" ||
    pedido.estado === "EN_PREPARACION" ||
    pedido.estado === "LISTO";

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href="/pedidos"
            className="text-xs font-semibold text-emerald-700 hover:underline"
          >
            ← Volver a la bandeja de pedidos
          </Link>

          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            <h1 className="font-mono text-2xl font-bold tracking-tight text-slate-900">
              {pedido.codigo}
            </h1>
            {pedido.estado && (
              <span
                className={`rounded-full border px-3 py-1 text-xs font-bold ${CLASE_ESTADO_PEDIDO[pedido.estado]}`}
              >
                {ETIQUETA_ESTADO_PEDIDO[pedido.estado]}
              </span>
            )}
            {pedido.esParcial && (
              <span className="rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                Pedido parcial
              </span>
            )}
          </div>

          <p className="mt-1 text-sm text-slate-600">
            {pedido.sedeNombre} ({pedido.sedeCodigo}) ·{" "}
            {pedido.modalidad ? ETIQUETA_MODALIDAD[pedido.modalidad] : ""} ·
            Creado {formatearFechaHora(pedido.createdAt)}
          </p>
        </div>

        {/* Barra de acciones según estado y rol */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={cargar}
            disabled={cargando}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Actualizar
          </button>

          {acciones.puedeTomar && (
            <button
              type="button"
              onClick={() => abrirModal("tomar")}
              className="rounded-lg bg-sky-700 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-800"
            >
              Tomar pedido
            </button>
          )}

          {acciones.puedeMarcarListo && (
            <button
              type="button"
              onClick={() => abrirModal("listo")}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800"
            >
              Marcar LISTO
            </button>
          )}

          {acciones.puedeEntregar && (
            <button
              type="button"
              onClick={() => abrirModal("entregar")}
              className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-800"
            >
              Entregar pedido
            </button>
          )}

          {acciones.puedeCancelar && (
            <button
              type="button"
              onClick={() => abrirModal("cancelar")}
              className="rounded-lg border border-rose-300 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100"
            >
              Cancelar pedido
            </button>
          )}
        </div>
      </div>

      {/* Avisos contextuales */}
      {acciones.bloqueadoPorOtroEmpleado && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Este pedido está siendo preparado por otro empleado (ID{" "}
          <span className="font-mono">{acortarUuid(pedido.asignadoA)}</span>).
          Según la regla RN-EMP-04, solo quien lo tomó o un administrador puede
          modificarlo mientras esté en preparación.
        </div>
      )}

      {pedido.estado === "LISTO" && pedido.modalidad === "DOMICILIO" && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
          Este pedido a domicilio ya está <strong>LISTO</strong> y queda
          disponible para asignación a una ruta de entrega (módulo Domicilios).
        </div>
      )}

      {/* Información general (RF-EMP-09) */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Paciente */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Paciente
          </h2>
          <p className="mt-2 text-base font-bold text-slate-900">
            {pedido.pacienteNombre ?? "—"}
          </p>
          <dl className="mt-2 space-y-1 text-xs text-slate-600">
            <div className="flex justify-between gap-2">
              <dt>Documento:</dt>
              <dd className="font-mono font-semibold text-slate-900">
                {pedido.pacienteTipoDocumento} {pedido.pacienteDocumento}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Teléfono:</dt>
              <dd className="font-medium text-slate-800">
                {pedido.pacienteTelefono || "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Fórmula:</dt>
              <dd className="font-mono font-semibold text-slate-900">
                {pedido.formulaCodigo}
              </dd>
            </div>
          </dl>
        </section>

        {/* Turno o Dirección */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {pedido.modalidad === "RECOGER"
              ? "Turno en sede"
              : "Entrega a domicilio"}
          </h2>

          {pedido.modalidad === "RECOGER" && pedido.turno ? (
            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-2xl font-bold text-emerald-800">
                  {pedido.turno.codigo}
                </span>
                {pedido.turno.estado && (
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${CLASE_ESTADO_TURNO[pedido.turno.estado]}`}
                  >
                    {ETIQUETA_ESTADO_TURNO[pedido.turno.estado]}
                  </span>
                )}
              </div>
              <dl className="space-y-1 text-xs text-slate-600">
                <div className="flex justify-between gap-2">
                  <dt>Fecha / Franja:</dt>
                  <dd className="font-medium text-slate-900">
                    {pedido.turno.fecha} · {formatearHora(pedido.turno.franjaInicio)}
                  </dd>
                </div>
                {pedido.turno.llamadoEn && (
                  <div className="flex justify-between gap-2">
                    <dt>Llamado:</dt>
                    <dd>{formatearFechaHora(pedido.turno.llamadoEn)}</dd>
                  </div>
                )}
                {pedido.turno.atendidoEn && (
                  <div className="flex justify-between gap-2">
                    <dt>Atendido:</dt>
                    <dd>{formatearFechaHora(pedido.turno.atendidoEn)}</dd>
                  </div>
                )}
              </dl>
            </div>
          ) : pedido.modalidad === "DOMICILIO" ? (
            <div className="mt-2 space-y-1.5 text-xs text-slate-600">
              <p className="text-sm font-semibold text-slate-900">
                {pedido.direccionEntrega || "Sin dirección registrada"}
              </p>
              {pedido.latitudEntrega !== undefined &&
                pedido.longitudEntrega !== undefined && (
                  <p className="font-mono text-[11px] text-slate-500">
                    Coords: {pedido.latitudEntrega}, {pedido.longitudEntrega}
                  </p>
                )}
              <p>
                Intentos de entrega:{" "}
                <strong className="text-slate-900">
                  {pedido.intentosEntrega ?? 0}
                </strong>
              </p>
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500">Sin datos de turno.</p>
          )}
        </section>

        {/* Tiempos y asignación */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Control de reserva
          </h2>
          <dl className="mt-2 space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between gap-2">
              <dt>Vence reserva:</dt>
              <dd
                className={`font-semibold ${
                  esActivo && urgencia.urgente ? "text-rose-700" : "text-slate-900"
                }`}
              >
                {formatearFechaHora(pedido.expiraEn)}
              </dd>
            </div>
            {esActivo && (
              <div className="flex justify-between gap-2">
                <dt>Urgencia:</dt>
                <dd
                  className={`font-semibold ${
                    urgencia.urgente ? "text-rose-700" : "text-emerald-700"
                  }`}
                >
                  {urgencia.texto}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <dt>Asignado a:</dt>
              <dd className="font-mono text-slate-800">
                {pedido.asignadoA
                  ? pedido.asignadoA === sesion?.usuario.id
                    ? "Tú (actual)"
                    : acortarUuid(pedido.asignadoA)
                  : "Sin asignar"}
              </dd>
            </div>
            {pedido.listoEn && (
              <div className="flex justify-between gap-2">
                <dt>Listo en:</dt>
                <dd>{formatearFechaHora(pedido.listoEn)}</dd>
              </div>
            )}
            {pedido.entregadoEn && (
              <div className="flex justify-between gap-2">
                <dt>Entregado en:</dt>
                <dd>{formatearFechaHora(pedido.entregadoEn)}</dd>
              </div>
            )}
          </dl>
        </section>
      </div>

      {/* Ítems del pedido */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Medicamentos del pedido
            </h2>
            <p className="text-xs text-slate-500">
              Cantidades solicitadas, reservadas y entregadas.
            </p>
          </div>
          {acciones.puedeAjustarFaltante && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
              RF-EMP-13: puedes reportar faltante físico durante preparación
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Medicamento</th>
                <th className="px-4 py-3 text-right">Solicitada</th>
                <th className="px-4 py-3 text-right">Reservada</th>
                <th className="px-4 py-3 text-right">Entregada</th>
                <th className="px-4 py-3">Estado ítem</th>
                {acciones.puedeAjustarFaltante && (
                  <th className="px-4 py-3 text-right">Diferencia física</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(pedido.items ?? []).map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">
                      {item.medicamentoNombre}
                    </p>
                    <p className="text-xs text-slate-500">
                      <span className="font-mono">{item.medicamentoCodigo}</span>{" "}
                      · {item.presentacion}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">
                    {item.cantidadSolicitada}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                    {item.cantidadReservada}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-700">
                    {item.cantidadEntregada}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        item.estadoItem === "COMPLETO"
                          ? "bg-emerald-100 text-emerald-800"
                          : item.estadoItem === "PARCIAL"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {item.estadoItem}
                    </span>
                  </td>
                  {acciones.puedeAjustarFaltante && (
                    <td className="px-4 py-3 text-right">
                      {(item.cantidadReservada ?? 0) > 0 && (
                        <button
                          type="button"
                          onClick={() => abrirModal("faltante", item)}
                          className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                        >
                          Reportar faltante
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Historial de transiciones (RN-08) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">
          Historial del pedido
        </h2>
        <p className="text-xs text-slate-500">
          Traza auditable de cada cambio de estado (RN-08).
        </p>

        <ol className="mt-4 space-y-3 border-l-2 border-emerald-200 pl-4">
          {(pedido.historial ?? []).map((h) => (
            <li key={h.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-emerald-600 ring-4 ring-white" />
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-slate-900">
                  {h.estadoAnterior ? `${h.estadoAnterior} → ` : ""}
                  {h.estadoNuevo}
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500">
                  {formatearFechaHora(h.createdAt)}
                </span>
                {h.usuarioId && (
                  <>
                    <span className="text-slate-400">·</span>
                    <span className="font-mono text-slate-500">
                      Usuario {acortarUuid(h.usuarioId)}
                    </span>
                  </>
                )}
              </div>
              {h.nota && (
                <p className="mt-1 text-xs text-slate-700">{h.nota}</p>
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* Modales de acciones */}
      <Modal
        abierto={modal !== null}
        onCerrar={cerrarModal}
        titulo={
          modal === "tomar"
            ? "Tomar pedido para preparación"
            : modal === "listo"
              ? "Confirmar pedido LISTO"
              : modal === "entregar"
                ? "Entregar pedido y verificar documento"
                : modal === "cancelar"
                  ? "Cancelar pedido"
                  : "Reportar diferencia física (RF-EMP-13)"
        }
        descripcion={
          modal === "entregar"
            ? `Solicita el documento de ${pedido.pacienteNombre ?? "el paciente"} y digítalo exactamente para confirmar la dispensación (RN-EMP-02).`
            : modal === "faltante" && itemFaltante
              ? `${itemFaltante.medicamentoNombre} (${itemFaltante.medicamentoCodigo}) · Reservado en este pedido: ${itemFaltante.cantidadReservada}`
              : `Pedido ${pedido.codigo}`
        }
      >
        <form onSubmit={ejecutarAccion} className="space-y-4">
          {(modal === "tomar" || modal === "listo") && (
            <div>
              <label
                htmlFor="pedido-nota"
                className="block text-xs font-semibold text-slate-700"
              >
                Nota operativa (opcional)
              </label>
              <textarea
                id="pedido-nota"
                rows={3}
                maxLength={500}
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder={
                  modal === "tomar"
                    ? "Ej. Iniciando alistamiento en estantería B"
                    : "Ej. Empacado y verificado completo"
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          )}

          {modal === "entregar" && (
            <>
              <div>
                <label
                  htmlFor="doc-verificado"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Documento del paciente ({pedido.pacienteTipoDocumento || "CC"})
                </label>
                <input
                  id="doc-verificado"
                  type="text"
                  required
                  maxLength={30}
                  value={documentoVerificado}
                  onChange={(e) => setDocumentoVerificado(e.target.value)}
                  placeholder="Digita el número de documento presentado"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Si el documento no coincide con el titular, la API responderá
                  422 y el pedido no cambiará de estado (CA-EMP-05).
                </p>
              </div>
              <div>
                <label
                  htmlFor="entrega-nota"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Nota de entrega (opcional)
                </label>
                <input
                  id="entrega-nota"
                  type="text"
                  maxLength={500}
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="Ej. Entregado en ventanilla 2"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </>
          )}

          {modal === "cancelar" && (
            <div>
              <label
                htmlFor="motivo-cancelacion"
                className="block text-xs font-semibold text-slate-700"
              >
                Motivo de cancelación (obligatorio)
              </label>
              <textarea
                id="motivo-cancelacion"
                required
                rows={3}
                maxLength={500}
                value={motivoCancelacion}
                onChange={(e) => setMotivoCancelacion(e.target.value)}
                placeholder="Ej. Paciente desistió de reclamar en sede"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Se liberará el stock reservado, se cancelará el turno asociado y
                se notificará al paciente.
              </p>
            </div>
          )}

          {modal === "faltante" && (
            <>
              <div>
                <label
                  htmlFor="cantidad-faltante"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Unidades faltantes en inventario físico
                </label>
                <input
                  id="cantidad-faltante"
                  type="number"
                  min={1}
                  required
                  value={cantidadFaltante}
                  onChange={(e) => setCantidadFaltante(e.target.value)}
                  placeholder="Ej. 2"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Se registrará un ajuste negativo de esa cantidad. Si el físico
                  cae bajo lo reservado, el sistema reducirá la reserva del
                  pedido más reciente, lo marcará parcial y notificará al
                  paciente (RN-EMP-07).
                </p>
              </div>
              <div>
                <label
                  htmlFor="motivo-faltante"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Motivo del ajuste (obligatorio)
                </label>
                <textarea
                  id="motivo-faltante"
                  required
                  rows={3}
                  maxLength={500}
                  value={motivoFaltante}
                  onChange={(e) => setMotivoFaltante(e.target.value)}
                  placeholder="Ej. Faltante físico detectado al preparar pedido"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </>
          )}

          {errorModal && (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
            >
              {errorModal}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={cerrarModal}
              disabled={procesando}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Volver
            </button>
            <button
              type="submit"
              disabled={procesando}
              className={`rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 ${
                modal === "cancelar"
                  ? "bg-rose-700 hover:bg-rose-800"
                  : "bg-emerald-700 hover:bg-emerald-800"
              }`}
            >
              {procesando ? "Procesando…" : "Confirmar"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function PedidoDetallePage() {
  return (
    <RoleGuard
      permitido={puedeGestionarPedidosYTurnos}
      mensajeDenegado="Solo auxiliares, farmacéuticos y administradores pueden ver o operar pedidos."
    >
      <PedidoDetalleContenido />
    </RoleGuard>
  );
}
