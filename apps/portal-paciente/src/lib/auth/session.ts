import type { AuthResponse, UsuarioResumen } from "../api/client";

export interface SesionPaciente {
  accessToken: string;
  expiresAt: number;
  usuario: UsuarioResumen;
}

const STORAGE_KEY = "farmagestion_portal_sesion_v1";

export function esPaciente(usuario?: UsuarioResumen | null): boolean {
  return usuario?.rol === "PACIENTE";
}

export function crearSesionDesdeAuth(auth: AuthResponse): SesionPaciente {
  const expiresInSeconds = auth.expiresIn ?? 7200;
  return {
    accessToken: auth.accessToken ?? "",
    expiresAt: Date.now() + expiresInSeconds * 1000,
    usuario: auth.usuario ?? {},
  };
}

export function sesionVigente(
  sesion: SesionPaciente | null
): sesion is SesionPaciente {
  if (!sesion || !sesion.accessToken || !sesion.usuario?.id || !esPaciente(sesion.usuario)) {
    return false;
  }
  return sesion.expiresAt > Date.now() + 10_000;
}

export function leerSesionGuardada(): SesionPaciente | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SesionPaciente;
    if (!sesionVigente(parsed)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function guardarSesion(sesion: SesionPaciente): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sesion));
}

export function limpiarSesion(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
