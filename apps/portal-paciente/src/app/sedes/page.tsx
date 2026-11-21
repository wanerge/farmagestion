"use client";

import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { portalApi, type SedePublica } from "@/lib/api/client";
import { formatearHora } from "@/lib/format";

const MapaSedesLeaflet = dynamic(
  () => import("@/components/MapaSedesLeaflet"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-72 w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-xs text-slate-500 sm:h-96">
        Cargando mapa de sedes…
      </div>
    ),
  }
);

function ContenidoSedes() {
  const searchParams = useSearchParams();
  const codigoInicial = searchParams.get("sede");

  const [sedes, setSedes] = useState<SedePublica[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sedeSeleccionadaId, setSedeSeleccionadaId] = useState<string | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    portalApi
      .listarSedes()
      .then((lista) => {
        if (cancelled) return;
        setSedes(lista);
        if (codigoInicial) {
          const encontrada = lista.find(
            (s) => s.codigo?.toUpperCase() === codigoInicial.toUpperCase()
          );
          if (encontrada?.id) {
            setSedeSeleccionadaId(encontrada.id);
          }
        }
      })
      .catch(() => {
        // Error global notificado
      })
      .finally(() => {
        if (!cancelled) setCargando(false);
      });
    return () => {
      cancelled = true;
    };
  }, [codigoInicial]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
            Nuestras sedes
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Selecciona una sede para ubicarla en el mapa y revisar su horario de
            atención.
          </p>
        </div>
        {sedeSeleccionadaId && (
          <button
            type="button"
            onClick={() => setSedeSeleccionadaId(null)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Ver todas en el mapa
          </button>
        )}
      </div>

      {/* Mapa interactivo Leaflet + OpenStreetMap (RF-PAC-05) */}
      <MapaSedesLeaflet
        sedes={sedes}
        sedeSeleccionadaId={sedeSeleccionadaId}
        onSeleccionarSede={setSedeSeleccionadaId}
      />

      {/* Lista de sedes */}
      {cargando ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white p-4"
            />
          ))}
        </div>
      ) : sedes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
          No se encontraron sedes activas en este momento.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {sedes.map((sede) => {
            const activa = sede.id === sedeSeleccionadaId;
            return (
              <button
                key={sede.id ?? sede.codigo}
                type="button"
                onClick={() => sede.id && setSedeSeleccionadaId(sede.id)}
                className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition ${
                  activa
                    ? "border-teal-500 bg-teal-50/50 ring-2 ring-teal-500/20"
                    : "border-slate-200 bg-white hover:border-teal-300"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                      {sede.codigo}
                    </span>
                    {activa && (
                      <span className="text-[11px] font-semibold text-teal-700">
                        En mapa
                      </span>
                    )}
                  </div>
                  <h2 className="mt-2 text-base font-bold text-slate-900">
                    {sede.nombre}
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    {sede.direccion}
                  </p>
                </div>

                <div className="mt-3 border-t border-slate-100 pt-2.5 text-xs text-slate-600">
                  <p>
                    <span className="font-semibold text-slate-800">Horario:</span>{" "}
                    {formatearHora(sede.horaApertura)} –{" "}
                    {formatearHora(sede.horaCierre)}
                  </p>
                  {typeof sede.latitud === "number" &&
                    typeof sede.longitud === "number" && (
                      <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                        {sede.latitud.toFixed(4)}, {sede.longitud.toFixed(4)}
                      </p>
                    )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SedesPage() {
  return (
    <Suspense
      fallback={
        <div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      }
    >
      <ContenidoSedes />
    </Suspense>
  );
}
