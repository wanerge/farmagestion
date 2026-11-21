"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  portalApi,
  suscribirErroresGlobales,
  suscribirEstadoLento,
  suscribirNoAutenticado,
  type RegistroPacienteRequest,
  type SedePublica,
} from "@/lib/api/client";
import type { ApiError } from "@/lib/api/problem";
import {
  crearSesionDesdeAuth,
  esPaciente,
  guardarSesion,
  leerSesionGuardada,
  limpiarSesion,
  type SesionPaciente,
} from "@/lib/auth/session";

interface AvisoGlobal {
  id: number;
  tipo: "error" | "exito";
  titulo: string;
  detalle: string;
  codigo?: string;
  errores?: Record<string, string>;
}

interface AppContextValue {
  ready: boolean;
  sesion: SesionPaciente | null;
  sedes: SedePublica[];
  noLeidas: number;
  refrescarNotificaciones: () => Promise<void>;
  iniciarSesion: (email: string, password: string) => Promise<void>;
  registrarPaciente: (datos: RegistroPacienteRequest) => Promise<void>;
  cerrarSesion: (motivoExpirada?: boolean) => void;
  mostrarExito: (titulo: string, detalle?: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const RUTAS_PUBLICAS = ["/", "/sedes", "/login", "/registro"];

function esRutaPublica(pathname: string | null): boolean {
  if (!pathname) return true;
  return RUTAS_PUBLICAS.includes(pathname);
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [ready, setReady] = useState(false);
  const [sesion, setSesion] = useState<SesionPaciente | null>(null);
  const [sedes, setSedes] = useState<SedePublica[]>([]);
  const [noLeidas, setNoLeidas] = useState<number>(0);
  const [despertando, setDespertando] = useState<boolean>(false);
  const [avisos, setAvisos] = useState<AvisoGlobal[]>([]);

  const agregarAviso = useCallback((aviso: Omit<AvisoGlobal, "id">) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setAvisos((prev) => {
      const base =
        aviso.tipo === "exito" ? prev.filter((a) => a.tipo !== "error") : prev;
      return [...base.slice(-3), { ...aviso, id }];
    });
    const duracionMs = aviso.tipo === "exito" ? 4500 : 8000;
    window.setTimeout(() => {
      setAvisos((prev) => prev.filter((a) => a.id !== id));
    }, duracionMs);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setAvisos((prev) =>
        prev.some((a) => a.tipo === "error")
          ? prev.filter((a) => a.tipo !== "error")
          : prev
      );
    }, 0);
    return () => window.clearTimeout(id);
  }, [pathname]);

  const descartarAviso = useCallback((id: number) => {
    setAvisos((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const mostrarExito = useCallback(
    (titulo: string, detalle = "") => {
      agregarAviso({ tipo: "exito", titulo, detalle });
    },
    [agregarAviso]
  );

  const cerrarSesion = useCallback(
    (motivoExpirada = false) => {
      limpiarSesion();
      setSesion(null);
      setNoLeidas(0);
      if (motivoExpirada || !esRutaPublica(pathname)) {
        router.replace(motivoExpirada ? "/login?expirada=1" : "/login");
      }
    },
    [pathname, router]
  );

  // Registro mínimo de service worker PWA (RF-PAC-19)
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      window.isSecureContext
    ) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // No bloquear el funcionamiento si el navegador restringe SW
      });
    }
  }, []);

  // Hidratar sesión desde localStorage
  useEffect(() => {
    const id = window.setTimeout(() => {
      const guardada = leerSesionGuardada();
      if (guardada) {
        setSesion(guardada);
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  // Temporizador para expirar sesión automáticamente al cumplirse las 2 h (RF-PAC-02)
  useEffect(() => {
    if (!sesion) return;
    const msRestantes = sesion.expiresAt - Date.now();
    if (msRestantes <= 0) {
      const id = window.setTimeout(() => cerrarSesion(true), 0);
      return () => window.clearTimeout(id);
    }
    const timer = window.setTimeout(() => {
      cerrarSesion(true);
    }, msRestantes);
    return () => window.clearTimeout(timer);
  }, [sesion, cerrarSesion]);

  // Suscripción global a arranque en frío (> 5 s), errores problem+json y 401
  useEffect(() => {
    const unsubSlow = suscribirEstadoLento(setDespertando);
    const unsubErr = suscribirErroresGlobales((err: ApiError) => {
      agregarAviso({
        tipo: "error",
        titulo: err.title,
        detalle: err.mensajeUsuario,
        codigo: err.code,
        errores: err.erroresCampos,
      });
    });
    const unsubUnauth = suscribirNoAutenticado(() => {
      cerrarSesion(true);
    });
    return () => {
      unsubSlow();
      unsubErr();
      unsubUnauth();
    };
  }, [agregarAviso, cerrarSesion]);

  // Catálogo público de sedes
  useEffect(() => {
    let cancelled = false;
    portalApi
      .listarSedes({ notifyGlobalError: false })
      .then((lista) => {
        if (!cancelled) {
          setSedes(lista);
        }
      })
      .catch(() => {
        // Se reintenta desde las pantallas que consultan sedes
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const accessToken = sesion?.accessToken;

  const refrescarNotificaciones = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await portalApi.listarNotificaciones(
        { soloNoLeidas: true, page: 0, size: 1 },
        { token: accessToken, notifyGlobalError: false }
      );
      setNoLeidas(res.noLeidas ?? 0);
    } catch {
      // No interrumpir al paciente por un fallo temporal de consulta periódica
    }
  }, [accessToken]);

  // Consulta periódica de notificaciones cada 20 segundos (RF-PAC-18)
  useEffect(() => {
    if (!accessToken) return;
    const inicio = window.setTimeout(() => {
      void refrescarNotificaciones();
    }, 0);
    const interval = window.setInterval(() => {
      void refrescarNotificaciones();
    }, 20_000);
    return () => {
      window.clearTimeout(inicio);
      window.clearInterval(interval);
    };
  }, [accessToken, refrescarNotificaciones]);

  const iniciarSesion = useCallback(async (email: string, password: string) => {
    const auth = await portalApi.login(
      { email: email.trim(), password },
      { notifyGlobalError: false }
    );
    if (!esPaciente(auth.usuario)) {
      throw new Error(
        "Esta aplicación es para pacientes. Si eres empleado o administrador, ingresa por el Panel de empleados."
      );
    }
    const nuevaSesion = crearSesionDesdeAuth(auth);
    guardarSesion(nuevaSesion);
    setSesion(nuevaSesion);
  }, []);

  const registrarPaciente = useCallback(
    async (datos: RegistroPacienteRequest) => {
      const auth = await portalApi.registrarPaciente(datos, {
        notifyGlobalError: false,
      });
      if (!esPaciente(auth.usuario)) {
        throw new Error("No fue posible iniciar sesión con la cuenta creada.");
      }
      const nuevaSesion = crearSesionDesdeAuth(auth);
      guardarSesion(nuevaSesion);
      setSesion(nuevaSesion);
    },
    []
  );

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      sesion,
      sedes,
      noLeidas,
      refrescarNotificaciones,
      iniciarSesion,
      registrarPaciente,
      cerrarSesion,
      mostrarExito,
    }),
    [
      ready,
      sesion,
      sedes,
      noLeidas,
      refrescarNotificaciones,
      iniciarSesion,
      registrarPaciente,
      cerrarSesion,
      mostrarExito,
    ]
  );

  return (
    <AppContext.Provider value={value}>
      {/* Banner global para arranque en frío (> 5 s) */}
      {despertando && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-amber-600 px-4 py-2 text-xs font-medium text-white shadow-md sm:text-sm"
        >
          <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
          <span>Despertando el servicio…</span>
        </div>
      )}

      {/* Avisos globales de errores problem+json y confirmaciones */}
      {avisos.length > 0 && (
        <div
          aria-live="assertive"
          className="pointer-events-none fixed inset-x-3 bottom-20 z-50 flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-full sm:max-w-md md:bottom-4"
        >
          {avisos.map((aviso) => (
            <div
              key={aviso.id}
              role="alert"
              className={`pointer-events-auto rounded-xl border p-3.5 shadow-lg ${
                aviso.tipo === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-950"
                  : "border-emerald-200 bg-emerald-50 text-emerald-950"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{aviso.titulo}</p>
                    {aviso.codigo && (
                      <span className="rounded bg-rose-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-rose-800">
                        {aviso.codigo}
                      </span>
                    )}
                  </div>
                  {aviso.detalle && (
                    <p className="mt-1 text-xs leading-relaxed opacity-90">
                      {aviso.detalle}
                    </p>
                  )}
                  {aviso.errores && Object.keys(aviso.errores).length > 0 && (
                    <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs">
                      {Object.entries(aviso.errores).map(([campo, msg]) => (
                        <li key={campo}>
                          <span className="font-medium">{campo}:</span> {msg}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => descartarAviso(aviso.id)}
                  className="rounded-md px-1.5 py-0.5 text-xs font-medium opacity-70 hover:bg-black/5 hover:opacity-100"
                  aria-label="Cerrar aviso"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useApp debe usarse dentro de AppProvider.");
  }
  return ctx;
}
