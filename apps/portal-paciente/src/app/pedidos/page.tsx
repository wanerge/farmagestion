"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { PacienteGuard } from "@/components/PacienteGuard";
import { portalApi, type PedidoResumen } from "@/lib/api/client";
import {
  CLASE_ESTADO_PEDIDO,
  ETIQUETA_ESTADO_PEDIDO,
  ETIQUETA_MODALIDAD,
  formatearFecha,
  formatearFechaHora,
  formatearHora,
  type EstadoPedido,
  type ModalidadPedido,
} from "@/lib/format";

const PAGE_SIZE = 10;

const ESTADOS_FILTRO: Array<{ valor: "" | EstadoPedido; etiqueta: string }> = [
  { valor: "", etiqueta: "Todos" },
  { valor: "RESERVADO", etiqueta: "Reservados" },
  { valor: "EN_PREPARACION", etiqueta: "En preparación" },
  { valor: "LISTO", etiqueta: "Listos" },
  { valor: "EN_RUTA", etiqueta: "En ruta" },
  { valor: "ENTREGADO", etiqueta: "Entregados" },
  { valor: "CANCELADO", etiqueta: "Cancelados" },
  { valor: "VENCIDO", etiqueta: "Vencidos" },
];

function ContenidoPedidos() {
  const { sesion } = useApp();
  const token = sesion?.accessToken ?? "";

  const [estado, setEstado] = useState<"" | EstadoPedido>("");
  const [page, setPage] = useState(0);
  const [pedidos, setPedidos] = useState<PedidoResumen[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [cargando, setCargando] = useState(true);

  const cargarPedidos = useCallback(async () => {
    if (!token) return;
    setCargando(true);
    try {
      const res = await portalApi.listarPedidos(
        {
          estado: estado || undefined,
          page,
          size: PAGE_SIZE,
        },
        { token }
      );
      setPedidos(res.content ?? []);
      setTotalElements(res.totalElements ?? 0);
    } catch {
      setPedidos([]);
      setTotalElements(0);
    } finally {
      setCargando(false);
    }
  }, [token, estado, page]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void cargarPedidos();
    }, 0);
    return () => window.clearTimeout(id);
  }, [cargarPedidos]);

  const totalPaginas = Math.max(1, Math.ceil(totalElements / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
            Mis pedidos
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Sigue el estado de tus reservas, consulta tu código de turno o
            revisa tu historial.
          </p>
        </div>

        <Link
          href="/pedidos/nuevo"
          className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-800"
        >
          + Nuevo pedido
        </Link>
      </div>

      {/* Filtro por estado (RF-PAC-16) */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {ESTADOS_FILTRO.map((item) => {
          const activo = estado === item.valor;
          return (
            <button
              key={item.valor || "TODOS"}
              type="button"
              onClick={() => {
                setEstado(item.valor);
                setPage(0);
              }}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                activo
                  ? "border-teal-700 bg-teal-700 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {item.etiqueta}
            </button>
          );
        })}
      </div>

      {cargando ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white"
            />
          ))}
        </div>
      ) : pedidos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-base font-semibold text-slate-900">
            {estado
              ? `No tienes pedidos en estado "${ETIQUETA_ESTADO_PEDIDO[estado]}".`
              : "Todavía no has creado ningún pedido."}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Desde tus fórmulas vinculadas puedes reservar medicamentos y agendar
            tu turno en sede.
          </p>
          <Link
            href="/pedidos/nuevo"
            className="mt-4 inline-flex rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Crear pedido ahora
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {pedidos.map((pedido) => {
            const est = (pedido.estado ?? "RESERVADO") as EstadoPedido;
            const mod = (pedido.modalidad ?? "RECOGER") as ModalidadPedido;

            return (
              <Link
                key={pedido.id}
                href={`/pedidos/${pedido.id}`}
                className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-teal-300 hover:shadow-sm sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-base font-bold text-slate-900">
                        {pedido.codigo}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${CLASE_ESTADO_PEDIDO[est]}`}
                      >
                        {ETIQUETA_ESTADO_PEDIDO[est]}
                      </span>
                      {pedido.esParcial && (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                          Parcial
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      {pedido.sedeNombre} · {ETIQUETA_MODALIDAD[mod]} · Fórmula{" "}
                      <span className="font-mono font-medium">
                        {pedido.formulaCodigo}
                      </span>
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Creado: {formatearFechaHora(pedido.createdAt)}
                    </p>
                  </div>

                  {pedido.turno?.codigo && (
                    <div className="rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-2 text-right">
                      <p className="text-[10px] font-semibold text-teal-700 uppercase">
                        Turno
                      </p>
                      <p className="font-mono text-base font-bold text-teal-900">
                        {pedido.turno.codigo}
                      </p>
                      <p className="text-[11px] text-teal-800">
                        {formatearFecha(pedido.turno.fecha)} ·{" "}
                        {formatearHora(pedido.turno.franjaInicio)}
                      </p>
                    </div>
                  )}
                </div>
              </Link>
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

export default function PedidosPage() {
  return (
    <PacienteGuard>
      <ContenidoPedidos />
    </PacienteGuard>
  );
}
