"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Modal } from "@/components/Modal";
import { RoleGuard } from "@/components/RoleGuard";
import {
  farmaApi,
  type InventarioItem,
  type PaginaInventario,
} from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import {
  esAdmin,
  puedeEditarInventario,
  puedeVerInventario,
} from "@/lib/auth/permisos";
import { CLASE_NIVEL_STOCK, ETIQUETA_NIVEL_STOCK } from "@/lib/format";

type ModalTipo = "entrada" | "ajuste" | "minimo";

function InventarioContenido() {
  const searchParams = useSearchParams();
  const { sesion, sedeSeleccionadaId, sedeActiva, mostrarExito, refrescarNotificaciones } =
    useApp();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [busquedaAplicada, setBusquedaAplicada] = useState(
    searchParams.get("q") ?? ""
  );
  const [bajoMinimo, setBajoMinimo] = useState(
    searchParams.get("bajoMinimo") === "true"
  );
  const [agotado, setAgotado] = useState(
    searchParams.get("agotado") === "true"
  );
  const [page, setPage] = useState(0);
  const [data, setData] = useState<PaginaInventario | null>(null);
  const [cargando, setCargando] = useState(true);

  // Estado del modal de operación (Entrada / Ajuste / Stock mínimo)
  const [modalTipo, setModalTipo] = useState<ModalTipo | null>(null);
  const [itemActivo, setItemActivo] = useState<InventarioItem | null>(null);
  const [cantidadInput, setCantidadInput] = useState("");
  const [motivoInput, setMotivoInput] = useState("");
  const [stockMinInput, setStockMinInput] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  const usuario = sesion?.usuario;
  const admin = esAdmin(usuario);
  const puedeEditar = puedeEditarInventario(usuario);
  const sedeFiltro = admin ? sedeSeleccionadaId || undefined : undefined;

  const accessToken = sesion?.accessToken;

  const cargar = useCallback(async () => {
    if (!accessToken) return;
    setCargando(true);
    try {
      const res = await farmaApi.listarInventario(
        {
          sedeId: sedeFiltro,
          q: busquedaAplicada.trim() || undefined,
          bajoMinimo: bajoMinimo ? true : undefined,
          agotado: agotado ? true : undefined,
          page,
          size: 20,
        },
        { token: accessToken }
      );
      setData(res);
    } catch {
      // Manejado por el interceptor global
    } finally {
      setCargando(false);
    }
  }, [accessToken, sedeFiltro, busquedaAplicada, bajoMinimo, agotado, page]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void cargar();
    }, 0);
    return () => window.clearTimeout(id);
  }, [cargar]);

  function abrirModal(tipo: ModalTipo, item: InventarioItem) {
    setItemActivo(item);
    setModalTipo(tipo);
    setErrorModal(null);
    setCantidadInput("");
    setMotivoInput("");
    setStockMinInput(String(item.stockMinimo ?? 0));
  }

  function cerrarModal() {
    if (guardando) return;
    setModalTipo(null);
    setItemActivo(null);
    setErrorModal(null);
  }

  async function manejarSubmitModal(e: React.FormEvent) {
    e.preventDefault();
    if (!sesion?.accessToken || !itemActivo?.medicamentoId || !modalTipo) return;

    setErrorModal(null);
    const sedeOperacion = admin ? itemActivo.sedeId : undefined;

    if (modalTipo === "entrada") {
      const cantidad = Number.parseInt(cantidadInput, 10);
      if (!Number.isInteger(cantidad) || cantidad < 1) {
        setErrorModal("Ingresa una cantidad entera mayor o igual a 1.");
        return;
      }
      setGuardando(true);
      try {
        await farmaApi.registrarEntrada(
          itemActivo.medicamentoId,
          { cantidad, motivo: motivoInput.trim() || undefined },
          sedeOperacion,
          { token: sesion.accessToken }
        );
        mostrarExito(
          "Entrada registrada",
          `+${cantidad} unidades para ${itemActivo.medicamentoNombre}.`
        );
        setModalTipo(null);
        setItemActivo(null);
        await Promise.all([cargar(), refrescarNotificaciones()]);
      } catch (err) {
        setErrorModal(
          isApiError(err) ? err.mensajeUsuario : "No fue posible registrar la entrada."
        );
      } finally {
        setGuardando(false);
      }
      return;
    }

    if (modalTipo === "ajuste") {
      const cantidad = Number.parseInt(cantidadInput, 10);
      if (!Number.isInteger(cantidad) || cantidad === 0) {
        setErrorModal(
          "Ingresa una cantidad entera positiva o negativa distinta de cero."
        );
        return;
      }
      if (!motivoInput.trim()) {
        setErrorModal("El motivo del ajuste es obligatorio (RN-EMP-03).");
        return;
      }
      setGuardando(true);
      try {
        await farmaApi.registrarAjuste(
          itemActivo.medicamentoId,
          { cantidad, motivo: motivoInput.trim() },
          sedeOperacion,
          { token: sesion.accessToken }
        );
        mostrarExito(
          "Ajuste registrado",
          `Ajuste de ${cantidad > 0 ? `+${cantidad}` : cantidad} unidades aplicado en ${itemActivo.medicamentoNombre}.`
        );
        setModalTipo(null);
        setItemActivo(null);
        await Promise.all([cargar(), refrescarNotificaciones()]);
      } catch (err) {
        setErrorModal(
          isApiError(err) ? err.mensajeUsuario : "No fue posible registrar el ajuste."
        );
      } finally {
        setGuardando(false);
      }
      return;
    }

    if (modalTipo === "minimo") {
      const stockMinimo = Number.parseInt(stockMinInput, 10);
      if (!Number.isInteger(stockMinimo) || stockMinimo < 0) {
        setErrorModal("El stock mínimo debe ser un entero mayor o igual a 0.");
        return;
      }
      setGuardando(true);
      try {
        await farmaApi.actualizarStockMinimo(
          itemActivo.medicamentoId,
          { stockMinimo },
          sedeOperacion,
          { token: sesion.accessToken }
        );
        mostrarExito(
          "Stock mínimo actualizado",
          `${itemActivo.medicamentoNombre} ahora tiene mínimo ${stockMinimo}.`
        );
        setModalTipo(null);
        setItemActivo(null);
        await cargar();
      } catch (err) {
        setErrorModal(
          isApiError(err)
            ? err.mensajeUsuario
            : "No fue posible actualizar el stock mínimo."
        );
      } finally {
        setGuardando(false);
      }
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
            Inventario
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">
            {sedeActiva
              ? `${sedeActiva.nombre} (${sedeActiva.codigo})`
              : admin
                ? "Todas las sedes"
                : "Inventario de tu sede"}
            {!puedeEditar ? " · Modo solo lectura (Auxiliar)" : ""}
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

      {/* Filtros (RF-EMP-03) */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(0);
          setBusquedaAplicada(q);
        }}
        className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center"
      >
        <div className="flex flex-1 gap-2">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar medicamento por nombre, principio activo o código…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Buscar
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="inline-flex cursor-pointer items-center gap-2 font-medium text-slate-700">
            <input
              type="checkbox"
              checked={bajoMinimo}
              onChange={(e) => {
                setBajoMinimo(e.target.checked);
                setPage(0);
              }}
              className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
            />
            <span>Bajo mínimo</span>
          </label>

          <label className="inline-flex cursor-pointer items-center gap-2 font-medium text-slate-700">
            <input
              type="checkbox"
              checked={agotado}
              onChange={(e) => {
                setAgotado(e.target.checked);
                setPage(0);
              }}
              className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
            />
            <span>Agotado</span>
          </label>

          {(busquedaAplicada || bajoMinimo || agotado) && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                setBusquedaAplicada("");
                setBajoMinimo(false);
                setAgotado(false);
                setPage(0);
              }}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </form>

      {/* Tabla de inventario */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Medicamento</th>
                {admin && <th className="px-4 py-3">Sede</th>}
                <th className="px-4 py-3 text-right">Física</th>
                <th className="px-4 py-3 text-right">Reservada</th>
                <th className="px-4 py-3 text-right">Disponible</th>
                <th className="px-4 py-3 text-right">Mínimo</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                <tr>
                  <td
                    colSpan={admin ? 8 : 7}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    Cargando inventario…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={admin ? 8 : 7}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No se encontraron medicamentos con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const kardexHref = item.medicamentoId
                    ? `/inventario/${item.medicamentoId}/kardex${
                        admin && item.sedeId
                          ? `?sedeId=${encodeURIComponent(item.sedeId)}&nombre=${encodeURIComponent(item.medicamentoNombre ?? "")}&sedeNombre=${encodeURIComponent(item.sedeNombre ?? "")}`
                          : `?nombre=${encodeURIComponent(item.medicamentoNombre ?? "")}`
                      }`
                    : "#";

                  return (
                    <tr
                      key={item.id ?? `${item.sedeId}-${item.medicamentoId}`}
                      className="hover:bg-slate-50/70"
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">
                          {item.medicamentoNombre}
                        </p>
                        <p className="text-xs text-slate-500">
                          <span className="font-mono">{item.medicamentoCodigo}</span>{" "}
                          · {item.principioActivo} · {item.presentacion}
                        </p>
                      </td>
                      {admin && (
                        <td className="px-4 py-3 text-xs text-slate-600">
                          <p className="font-medium text-slate-800">
                            {item.sedeNombre}
                          </p>
                          <p className="font-mono text-[11px] text-slate-500">
                            {item.sedeCodigo}
                          </p>
                        </td>
                      )}
                      <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">
                        {item.cantidadFisica}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600">
                        {item.cantidadReservada}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                        {item.disponible}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600">
                        {item.stockMinimo}
                      </td>
                      <td className="px-4 py-3">
                        {item.nivel && (
                          <span
                            className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${CLASE_NIVEL_STOCK[item.nivel]}`}
                          >
                            {ETIQUETA_NIVEL_STOCK[item.nivel]}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Link
                            href={kardexHref}
                            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Kárdex
                          </Link>
                          {puedeEditar && (
                            <>
                              <button
                                type="button"
                                onClick={() => abrirModal("entrada", item)}
                                className="rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-800"
                              >
                                Entrada
                              </button>
                              <button
                                type="button"
                                onClick={() => abrirModal("ajuste", item)}
                                className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                              >
                                Ajuste
                              </button>
                              <button
                                type="button"
                                onClick={() => abrirModal("minimo", item)}
                                className="rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                              >
                                Mínimo
                              </button>
                            </>
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

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>
            Página {page + 1} de {totalPages} ({totalElements} medicamentos)
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

      {/* Modal Entrada / Ajuste / Stock mínimo */}
      <Modal
        abierto={modalTipo !== null && itemActivo !== null}
        onCerrar={cerrarModal}
        titulo={
          modalTipo === "entrada"
            ? "Registrar entrada de stock"
            : modalTipo === "ajuste"
              ? "Registrar ajuste de inventario"
              : "Editar stock mínimo"
        }
        descripcion={
          itemActivo
            ? `${itemActivo.medicamentoNombre} (${itemActivo.medicamentoCodigo}) · ${itemActivo.sedeNombre ?? ""}`
            : undefined
        }
      >
        {itemActivo && (
          <form onSubmit={manejarSubmitModal} className="space-y-4">
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center text-xs">
              <div>
                <p className="text-slate-500">Física</p>
                <p className="mt-0.5 font-mono text-base font-bold text-slate-900">
                  {itemActivo.cantidadFisica}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Reservada</p>
                <p className="mt-0.5 font-mono text-base font-bold text-slate-700">
                  {itemActivo.cantidadReservada}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Disponible</p>
                <p className="mt-0.5 font-mono text-base font-bold text-emerald-700">
                  {itemActivo.disponible}
                </p>
              </div>
            </div>

            {modalTipo === "entrada" && (
              <>
                <div>
                  <label
                    htmlFor="entrada-cantidad"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Cantidad a ingresar
                  </label>
                  <input
                    id="entrada-cantidad"
                    type="number"
                    min={1}
                    required
                    value={cantidadInput}
                    onChange={(e) => setCantidadInput(e.target.value)}
                    placeholder="Ej. 40"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="entrada-motivo"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Motivo (opcional)
                  </label>
                  <input
                    id="entrada-motivo"
                    type="text"
                    maxLength={500}
                    value={motivoInput}
                    onChange={(e) => setMotivoInput(e.target.value)}
                    placeholder="Ej. Reposición semanal de bodega"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </>
            )}

            {modalTipo === "ajuste" && (
              <>
                <div>
                  <label
                    htmlFor="ajuste-cantidad"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Cantidad de ajuste (positivo o negativo)
                  </label>
                  <input
                    id="ajuste-cantidad"
                    type="number"
                    required
                    value={cantidadInput}
                    onChange={(e) => setCantidadInput(e.target.value)}
                    placeholder="Ej. -5 o 3"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Si un ajuste negativo reduce el físico por debajo de lo
                    reservado, el sistema reducirá la reserva del pedido más
                    reciente y notificará al paciente (RN-EMP-07), o rechazará el
                    ajuste si no es posible.
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="ajuste-motivo"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Motivo (obligatorio)
                  </label>
                  <textarea
                    id="ajuste-motivo"
                    required
                    rows={3}
                    maxLength={500}
                    value={motivoInput}
                    onChange={(e) => setMotivoInput(e.target.value)}
                    placeholder="Ej. Diferencia en conteo físico / unidad averiada"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </>
            )}

            {modalTipo === "minimo" && (
              <div>
                <label
                  htmlFor="stock-minimo"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Stock mínimo de alerta
                </label>
                <input
                  id="stock-minimo"
                  type="number"
                  min={0}
                  required
                  value={stockMinInput}
                  onChange={(e) => setStockMinInput(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
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
                disabled={guardando}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {guardando ? "Guardando…" : "Confirmar"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

export default function InventarioPage() {
  return (
    <RoleGuard
      permitido={puedeVerInventario}
      mensajeDenegado="Solo auxiliares, farmacéuticos y administradores pueden consultar el inventario."
    >
      <Suspense
        fallback={
          <div className="py-10 text-center text-sm text-slate-500">
            Cargando inventario…
          </div>
        }
      >
        <InventarioContenido />
      </Suspense>
    </RoleGuard>
  );
}
