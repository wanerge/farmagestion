import type { AuthResponse, UsuarioResumen } from "../api/client";

export interface SesionPanel {
  accessToken: string;
  expiresAt: number;
  usuario: UsuarioResumen;
}

const STORAGE_KEY = "farmagestion_panel_sesion_v1";

export function crearSesionDesdeAuth(auth: AuthResponse): SesionPanel {
  const expiresInSeconds = auth.expiresIn ?? 7200;
  return {
    accessToken: auth.accessToken ?? "",
    expiresAt: Date.now() + expiresInSeconds * 1000,
    usuario: auth.usuario ?? {},
  };
}

export function sesionVigente(sesion: SesionPanel | null): sesion is SesionPanel {
  if (!sesion || !sesion.accessToken || !sesion.usuario?.id) {
    return false;
  }
  return sesion.expiresAt > Date.now() + 10_000;
}

export function leerSesionGuardada(): SesionPanel | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SesionPanel;
    if (!sesionVigente(parsed)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function guardarSesion(sesion: SesionPanel): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sesion));
}

export function limpiarSesion(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
