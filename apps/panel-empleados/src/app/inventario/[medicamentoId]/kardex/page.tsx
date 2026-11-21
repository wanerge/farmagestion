"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { RoleGuard } from "@/components/RoleGuard";
import {
  farmaApi,
  type PaginaKardex,
  type TipoMovimiento,
} from "@/lib/api/client";
import { esAdmin, puedeVerInventario } from "@/lib/auth/permisos";
import {
  acortarUuid,
  CLASE_MOVIMIENTO,
  ETIQUETA_MOVIMIENTO,
  formatearFechaHora,
} from "@/lib/format";

const TIPOS_MOVIMIENTO: TipoMovimiento[] = [
  "ENTRADA",
  "AJUSTE_POS",
  "AJUSTE_NEG",
  "RESERVA",
  "LIBERACION",
  "DISPENSACION",
  "TRASLADO_SALIDA",
  "TRASLADO_ENTRADA",
];

function KardexContenido() {
  const params = useParams<{ medicamentoId: string }>();
  const searchParams = useSearchParams();
  const { sesion, sedes, sedeSeleccionadaId } = useApp();

  const medicamentoId = params.medicamentoId;
  const nombreMed = searchParams.get("nombre") ?? "";
  const sedeNombreQuery = searchParams.get("sedeNombre") ?? "";
  const sedeIdQuery = searchParams.get("sedeId") ?? "";

  const admin = esAdmin(sesion?.usuario);
  const sedeOperacion = admin
    ? sedeIdQuery || sedeSeleccionadaId || sedes[0]?.id || ""
    : undefined;

  const [tipo, setTipo] = useState<TipoMovimiento | "">("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<PaginaKardex | null>(null);
  const [cargando, setCargando] = useState(true);

  const accessToken = sesion?.accessToken;

  const cargar = useCallback(async () => {
    if (!accessToken || !medicamentoId) return;
    if (admin && !sedeOperacion) return;
    setCargando(true);
    try {
      const res = await farmaApi.consultarKardex(
        medicamentoId,
        {
          sedeId: admin ? sedeOperacion : undefined,
          tipo: tipo || undefined,
          desde: desde || undefined,
          hasta: hasta || undefined,
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
  }, [accessToken, medicamentoId, admin, sedeOperacion, tipo, desde, hasta, page]);

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
          <Link
            href="/inventario"
            className="text-xs font-semibold text-emerald-700 hover:underline"
          >
            ← Volver a inventario
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Kárdex de movimientos
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">
            {nombreMed || `Medicamento ${acortarUuid(medicamentoId)}`}
            {sedeNombreQuery ? ` · ${sedeNombreQuery}` : ""}
          </p>
        </div>

        <button
          type="button"
          onClick={cargar}
          disabled={cargando}
          className="self-start rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 sm:self-auto"
        >
          Actualizar
        </button>
      </div>

      {/* Filtros RF-EMP-06 */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label
            htmlFor="kardex-tipo"
            className="block text-xs font-semibold text-slate-700"
          >
            Tipo de movimiento
          </label>
          <select
            id="kardex-tipo"
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value as TipoMovimiento | "");
              setPage(0);
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Todos los tipos</option>
            {TIPOS_MOVIMIENTO.map((t) => (
              <option key={t} value={t}>
                {ETIQUETA_MOVIMIENTO[t]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="kardex-desde"
            className="block text-xs font-semibold text-slate-700"
          >
            Desde (fecha)
          </label>
          <input
            id="kardex-desde"
            type="date"
            value={desde}
            onChange={(e) => {
              setDesde(e.target.value);
              setPage(0);
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label
            htmlFor="kardex-hasta"
            className="block text-xs font-semibold text-slate-700"
          >
            Hasta (fecha)
          </label>
          <input
            id="kardex-hasta"
            type="date"
            value={hasta}
            onChange={(e) => {
              setHasta(e.target.value);
              setPage(0);
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={() => {
              setTipo("");
              setDesde("");
              setHasta("");
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
                <th className="px-4 py-3">Fecha y hora</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3 text-right">Cantidad</th>
                <th className="px-4 py-3 text-right">Saldo físico</th>
                <th className="px-4 py-3">Referencia</th>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Cargando movimientos del kárdex…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No hay movimientos registrados para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                items.map((mov) => {
                  const esSalida =
                    mov.tipo === "AJUSTE_NEG" ||
                    mov.tipo === "DISPENSACION" ||
                    mov.tipo === "TRASLADO_SALIDA";
                  return (
                    <tr key={mov.id} className="hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                        {formatearFechaHora(mov.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        {mov.tipo && (
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${CLASE_MOVIMIENTO[mov.tipo]}`}
                          >
                            {ETIQUETA_MOVIMIENTO[mov.tipo]}
                          </span>
                        )}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono font-semibold ${
                          esSalida ? "text-rose-700" : "text-emerald-700"
                        }`}
                      >
                        {esSalida && (mov.cantidad ?? 0) > 0
                          ? `-${mov.cantidad}`
                          : (mov.cantidad ?? 0) > 0
                            ? `+${mov.cantidad}`
                            : mov.cantidad}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                        {mov.saldoFisico}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {mov.referenciaTipo === "PEDIDO" && mov.referenciaId ? (
                          <Link
                            href={`/pedidos/${mov.referenciaId}`}
                            className="font-semibold text-emerald-700 hover:underline"
                          >
                            Pedido {acortarUuid(mov.referenciaId)}
                          </Link>
                        ) : (
                          <span className="text-slate-600">
                            {mov.referenciaTipo ?? "—"}
                            {mov.referenciaId
                              ? ` (${acortarUuid(mov.referenciaId)})`
                              : ""}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {acortarUuid(mov.usuarioId)}
                      </td>
                      <td className="max-w-xs px-4 py-3 text-xs text-slate-700">
                        {mov.motivo || "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>
            Página {page + 1} de {totalPages} ({totalElements} movimientos)
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

export default function KardexPage() {
  return (
    <RoleGuard
      permitido={puedeVerInventario}
      mensajeDenegado="Solo auxiliares, farmacéuticos y administradores pueden consultar el kárdex."
    >
      <Suspense
        fallback={
          <div className="py-10 text-center text-sm text-slate-500">
            Cargando kárdex…
          </div>
        }
      >
        <KardexContenido />
      </Suspense>
    </RoleGuard>
  );
}
