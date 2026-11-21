"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Modal } from "@/components/Modal";
import { RoleGuard } from "@/components/RoleGuard";
import { farmaApi, type Turno } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import { esAdmin, puedeGestionarPedidosYTurnos } from "@/lib/auth/permisos";
import {
  CLASE_ESTADO_TURNO,
  ETIQUETA_ESTADO_TURNO,
  fechaHoyBogota,
  formatearFechaHora,
  formatearHora,
} from "@/lib/format";

function TurnosContenido() {
  const {
    sesion,
    sedes,
    sedeSeleccionadaId,
    setSedeSeleccionadaId,
    sedeActiva,
    mostrarExito,
  } = useApp();

  const [fecha, setFecha] = useState(fechaHoyBogota);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [cargando, setCargando] = useState(true);
  const [llamando, setLlamando] = useState(false);
  const [ultimoLlamado, setUltimoLlamado] = useState<Turno | null>(null);
  const [turnoAVencer, setTurnoAVencer] = useState<Turno | null>(null);
  const [venciendo, setVenciendo] = useState(false);
  const [errorVencer, setErrorVencer] = useState<string | null>(null);

  const admin = esAdmin(sesion?.usuario);
  const sedeEfectivaId = admin
    ? sedeSeleccionadaId || sedes[0]?.id || ""
    : undefined;
  const sedeEfectiva = admin
    ? sedes.find((s) => s.id === sedeEfectivaId) ?? null
    : sedeActiva;

  // Si es ADMIN y no tiene sede seleccionada, preseleccionar la primera para operar turnos
  useEffect(() => {
    if (admin && !sedeSeleccionadaId && sedes.length > 0 && sedes[0].id) {
      setSedeSeleccionadaId(sedes[0].id);
    }
  }, [admin, sedeSeleccionadaId, sedes, setSedeSeleccionadaId]);

  const accessToken = sesion?.accessToken;

  const cargar = useCallback(async () => {
    if (!accessToken) return;
    if (admin && !sedeEfectivaId) return;
    setCargando(true);
    try {
      const lista = await farmaApi.listarTurnos(
        { sedeId: sedeEfectivaId, fecha },
        { token: accessToken }
      );
      setTurnos(lista);
    } catch {
      // Manejado globalmente
    } finally {
      setCargando(false);
    }
  }, [accessToken, admin, sedeEfectivaId, fecha]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void cargar();
    }, 0);
    return () => window.clearTimeout(id);
  }, [cargar]);

  async function manejarLlamarSiguiente() {
    if (!sesion?.accessToken) return;
    if (admin && !sedeEfectivaId) return;
    setLlamando(true);
    try {
      const turno = await farmaApi.llamarSiguienteTurno(
        { sedeId: sedeEfectivaId, fecha },
        { token: sesion.accessToken }
      );
      setUltimoLlamado(turno);
      mostrarExito(
        `Turno ${turno.codigo} llamado`,
        "El turno ya aparece en la pantalla pública de sala y el paciente fue notificado."
      );
      await cargar();
    } catch {
      // Manejado globalmente (ej. 409 SIN_TURNOS_EN_ESPERA)
    } finally {
      setLlamando(false);
    }
  }

  async function confirmarVencerTurno() {
    if (!sesion?.accessToken || !turnoAVencer?.id) return;
    setVenciendo(true);
    setErrorVencer(null);
    try {
      await farmaApi.vencerTurno(turnoAVencer.id, {
        token: sesion.accessToken,
      });
      mostrarExito(
        `Turno ${turnoAVencer.codigo} vencido`,
        "El pedido asociado pasó a VENCIDO y se liberó el stock reservado."
      );
      setTurnoAVencer(null);
      await cargar();
    } catch (err) {
      setErrorVencer(
        isApiError(err) ? err.mensajeUsuario : "No fue posible vencer el turno."
      );
    } finally {
      setVenciendo(false);
    }
  }

  const enEspera = turnos.filter((t) => t.estado === "EN_ESPERA").length;
  const llamados = turnos.filter((t) => t.estado === "LLAMADO").length;
  const atendidos = turnos.filter((t) => t.estado === "ATENDIDO").length;
  const vencidos = turnos.filter((t) => t.estado === "VENCIDO").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Cola de turnos
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">
            {sedeEfectiva
              ? `${sedeEfectiva.nombre} (${sedeEfectiva.codigo})`
              : "Sede operativa"}{" "}
            · Ordenada por franja y número (RF-EMP-15 a RF-EMP-17)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {sedeEfectiva?.codigo && (
            <Link
              href={`/sala/${encodeURIComponent(sedeEfectiva.codigo)}`}
              target="_blank"
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              Pantalla pública de sala ↗
            </Link>
          )}

          <button
            type="button"
            onClick={manejarLlamarSiguiente}
            disabled={llamando || enEspera === 0}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {llamando ? "Llamando…" : "Llamar siguiente"}
          </button>
        </div>
      </div>

      {/* Destacado de último turno llamado */}
      {ultimoLlamado && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
              Último turno llamado
            </p>
            <p className="mt-1 font-mono text-3xl font-extrabold text-amber-950">
              {ultimoLlamado.codigo}
            </p>
            <p className="text-xs text-amber-900">
              Franja {formatearHora(ultimoLlamado.franjaInicio)} · Llamado{" "}
              {formatearFechaHora(ultimoLlamado.llamadoEn)}
            </p>
          </div>
          {ultimoLlamado.pedidoId && (
            <Link
              href={`/pedidos/${ultimoLlamado.pedidoId}`}
              className="self-start rounded-lg bg-amber-900 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-950 sm:self-auto"
            >
              Ir al pedido para entregar →
            </Link>
          )}
        </div>
      )}

      {/* Filtros y resumen */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label
              htmlFor="turnos-fecha"
              className="block text-xs font-semibold text-slate-700"
            >
              Fecha
            </label>
            <input
              id="turnos-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="mt-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>

          <button
            type="button"
            onClick={cargar}
            disabled={cargando}
            className="mt-5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            {cargando ? "Actualizando…" : "Actualizar"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-800">
            En espera: {enEspera}
          </span>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">
            Llamados: {llamados}
          </span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">
            Atendidos: {atendidos}
          </span>
          <span className="rounded-full bg-slate-200 px-3 py-1 text-slate-700">
            Vencidos: {vencidos}
          </span>
        </div>
      </div>

      {/* Tabla de turnos */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Franja</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Llamado</th>
                <th className="px-4 py-3">Atendido</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Cargando cola de turnos…
                  </td>
                </tr>
              ) : turnos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No hay turnos agendados para {fecha} en esta sede.
                  </td>
                </tr>
              ) : (
                turnos.map((turno) => {
                  const puedeVencer =
                    turno.estado === "EN_ESPERA" || turno.estado === "LLAMADO";
                  return (
                    <tr
                      key={turno.id}
                      className={
                        turno.estado === "LLAMADO"
                          ? "bg-amber-50/50"
                          : "hover:bg-slate-50/70"
                      }
                    >
                      <td className="px-4 py-3 font-mono text-base font-bold text-slate-900">
                        {turno.codigo}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {formatearHora(turno.franjaInicio)}
                      </td>
                      <td className="px-4 py-3">
                        {turno.estado && (
                          <span
                            className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${CLASE_ESTADO_TURNO[turno.estado]}`}
                          >
                            {ETIQUETA_ESTADO_TURNO[turno.estado]}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {formatearFechaHora(turno.llamadoEn)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {formatearFechaHora(turno.atendidoEn)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          {turno.pedidoId && (
                            <Link
                              href={`/pedidos/${turno.pedidoId}`}
                              className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              Ver pedido
                            </Link>
                          )}
                          {puedeVencer && (
                            <button
                              type="button"
                              onClick={() => {
                                setTurnoAVencer(turno);
                                setErrorVencer(null);
                              }}
                              className="rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-100"
                            >
                              No se presentó
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal confirmar vencer turno */}
      <Modal
        abierto={turnoAVencer !== null}
        onCerrar={() => !venciendo && setTurnoAVencer(null)}
        titulo="Marcar turno como vencido"
        descripcion={
          turnoAVencer
            ? `¿Confirmas que el paciente del turno ${turnoAVencer.codigo} no se presentó?`
            : undefined
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Al marcar este turno como <strong>VENCIDO</strong>, el pedido
            asociado también pasará a <strong>VENCIDO</strong> y el inventario
            reservado se liberará automáticamente (RF-EMP-17).
          </p>

          {errorVencer && (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
            >
              {errorVencer}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setTurnoAVencer(null)}
              disabled={venciendo}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmarVencerTurno}
              disabled={venciendo}
              className="rounded-lg bg-rose-700 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
            >
              {venciendo ? "Procesando…" : "Confirmar vencimiento"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function TurnosPage() {
  return (
    <RoleGuard
      permitido={puedeGestionarPedidosYTurnos}
      mensajeDenegado="Solo auxiliares, farmacéuticos y administradores pueden operar la cola de turnos."
    >
      <TurnosContenido />
    </RoleGuard>
  );
}
