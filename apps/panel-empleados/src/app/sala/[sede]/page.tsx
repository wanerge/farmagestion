"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { farmaApi, type PantallaSala } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";
import { formatearHora } from "@/lib/format";

const INTERVALO_POLLING_MS = 10_000; // 03 §9: consulta periódica cada 10 segundos

export default function PantallaSalaPage() {
  const params = useParams<{ sede: string }>();
  const sedeCodigo = decodeURIComponent(params.sede ?? "");

  const [sala, setSala] = useState<PantallaSala | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [horaActual, setHoraActual] = useState<string>("");

  const consultar = useCallback(async () => {
    if (!sedeCodigo) return;
    try {
      const data = await farmaApi.consultarPantallaSala(sedeCodigo, undefined, {
        notifyGlobalError: false,
      });
      setSala(data);
      setError(null);
    } catch (err) {
      setError(
        isApiError(err)
          ? err.mensajeUsuario
          : "No fue posible actualizar la pantalla de turnos."
      );
    } finally {
      setCargando(false);
    }
  }, [sedeCodigo]);

  useEffect(() => {
    const inicio = window.setTimeout(() => {
      void consultar();
    }, 0);
    const id = window.setInterval(() => {
      void consultar();
    }, INTERVALO_POLLING_MS);
    return () => {
      window.clearTimeout(inicio);
      window.clearInterval(id);
    };
  }, [consultar]);

  useEffect(() => {
    const actualizarReloj = () => {
      setHoraActual(
        new Intl.DateTimeFormat("es-CO", {
          timeZone: "America/Bogota",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(new Date())
      );
    };
    actualizarReloj();
    const id = setInterval(actualizarReloj, 1000);
    return () => clearInterval(id);
  }, []);

  const llamados = sala?.llamados ?? [];
  const enEspera = sala?.enEspera ?? [];

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-white">
      {/* Cabecera TV */}
      <header className="border-b border-slate-800 bg-slate-900/90 px-6 py-5 sm:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-lg font-extrabold text-white">
              FG
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
                FarmaGestión · Pantalla de turnos
              </p>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {sala?.sedeNombre ?? sedeCodigo}
              </h1>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <p className="font-mono text-2xl font-bold text-emerald-300 sm:text-3xl">
              {horaActual || "--:--:--"}
            </p>
            <p className="text-xs text-slate-400">
              {sala?.fecha ? `Fecha: ${sala.fecha} · ` : ""}
              Actualización automática cada 10 s
            </p>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-6 py-8 sm:px-10">
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-rose-500/40 bg-rose-950/60 px-4 py-3 text-sm text-rose-200"
          >
            {error}
          </div>
        )}

        {cargando && !sala ? (
          <div className="flex flex-1 items-center justify-center text-lg text-slate-400">
            Cargando turnos de {sedeCodigo}…
          </div>
        ) : (
          <div className="grid flex-1 gap-8 lg:grid-cols-12">
            {/* Turnos llamados */}
            <section className="flex flex-col rounded-3xl border border-emerald-500/30 bg-slate-900 p-6 shadow-xl lg:col-span-7">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h2 className="text-lg font-bold uppercase tracking-wider text-emerald-400 sm:text-xl">
                  Turnos llamados
                </h2>
                <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300">
                  Acérquese a ventanilla
                </span>
              </div>

              {llamados.length === 0 ? (
                <div className="flex flex-1 items-center justify-center py-16 text-center text-slate-400">
                  <p className="text-lg">
                    No hay turnos llamados en este momento.
                  </p>
                </div>
              ) : (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {llamados.map((turno, idx) => (
                    <div
                      key={`${turno.codigo}-${idx}`}
                      className={`rounded-2xl border p-6 text-center ${
                        idx === 0
                          ? "border-emerald-400 bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 sm:col-span-2"
                          : "border-slate-700 bg-slate-800/90 text-white"
                      }`}
                    >
                      <p
                        className={`font-mono font-extrabold tracking-wider ${
                          idx === 0 ? "text-5xl sm:text-7xl" : "text-4xl sm:text-5xl"
                        }`}
                      >
                        {turno.codigo}
                      </p>
                      <p
                        className={`mt-2 text-sm font-medium ${
                          idx === 0 ? "text-emerald-100" : "text-slate-300"
                        }`}
                      >
                        Franja {formatearHora(turno.franjaInicio)}
                        {turno.llamadoEn
                          ? ` · Llamado ${formatearHora(turno.llamadoEn)}`
                          : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Turnos en espera */}
            <section className="flex flex-col rounded-3xl border border-slate-800 bg-slate-900/80 p-6 lg:col-span-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h2 className="text-lg font-bold uppercase tracking-wider text-sky-400 sm:text-xl">
                  En espera
                </h2>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-slate-300">
                  {enEspera.length}
                </span>
              </div>

              {enEspera.length === 0 ? (
                <div className="flex flex-1 items-center justify-center py-16 text-center text-slate-500">
                  <p className="text-base">No hay turnos en espera.</p>
                </div>
              ) : (
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
                  {enEspera.map((turno, idx) => (
                    <div
                      key={`${turno.codigo}-${idx}`}
                      className="rounded-2xl border border-slate-800 bg-slate-800/60 px-4 py-4 text-center"
                    >
                      <p className="font-mono text-2xl font-bold tracking-wide text-white sm:text-3xl">
                        {turno.codigo}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Franja {formatearHora(turno.franjaInicio)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      <footer className="border-t border-slate-900 px-6 py-3 text-center text-xs text-slate-500">
        Pantalla informativa pública · Solo códigos de turno, sin datos personales
        (RF-EMP-18).
      </footer>
    </main>
  );
}
