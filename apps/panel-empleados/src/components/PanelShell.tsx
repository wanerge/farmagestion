"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  esAdmin,
  etiquetaRolUsuario,
  puedeGestionarPedidosYTurnos,
  puedeVerInventario,
} from "@/lib/auth/permisos";
import { useApp } from "./AppProvider";

interface NavItem {
  href: string;
  label: string;
  badge?: number;
}

export function PanelShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    sesion,
    sedes,
    sedeSeleccionadaId,
    setSedeSeleccionadaId,
    sedeActiva,
    noLeidas,
    cerrarSesion,
  } = useApp();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const usuario = sesion?.usuario;
  const admin = esAdmin(usuario);

  const navItems: NavItem[] = [{ href: "/", label: "Tablero" }];
  if (puedeVerInventario(usuario)) {
    navItems.push({ href: "/inventario", label: "Inventario" });
  }
  if (puedeGestionarPedidosYTurnos(usuario)) {
    navItems.push({ href: "/pedidos", label: "Pedidos" });
    navItems.push({ href: "/turnos", label: "Turnos" });
  }
  navItems.push({
    href: "/notificaciones",
    label: "Notificaciones",
    badge: noLeidas > 0 ? noLeidas : undefined,
  });

  const esActivo = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname?.startsWith(`${href}/`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="bg-amber-100 px-4 py-1 text-center text-[11px] font-medium text-amber-900">
        FarmaGestión S.A.S. · Entorno de simulación académica (datos sintéticos)
      </div>

      {/* Barra superior */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuAbierto((v) => !v)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 md:hidden"
              aria-label="Abrir menú de navegación"
              aria-expanded={menuAbierto}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={menuAbierto ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
                />
              </svg>
            </button>

            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white shadow-sm">
                FG
              </span>
              <div className="leading-tight">
                <p className="text-sm font-bold tracking-tight text-slate-900 sm:text-base">
                  Panel de empleados
                </p>
                <p className="hidden text-[11px] text-slate-500 sm:block">
                  FarmaGestión · Gestión operativa
                </p>
              </div>
            </Link>
          </div>

          {/* Navegación escritorio */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Principal">
            {navItems.map((item) => {
              const active = esActivo(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Contexto de sede y usuario */}
          <div className="flex items-center gap-2 sm:gap-3">
            {admin ? (
              <select
                aria-label="Seleccionar sede activa"
                value={sedeSeleccionadaId}
                onChange={(e) => setSedeSeleccionadaId(e.target.value)}
                className="max-w-[155px] rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 sm:max-w-[200px]"
              >
                <option value="">Todas las sedes</option>
                {sedes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} ({s.codigo})
                  </option>
                ))}
              </select>
            ) : (
              <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 lg:inline-block">
                {sedeActiva ? `${sedeActiva.nombre}` : "Mi sede"}
              </span>
            )}

            <div className="hidden text-right leading-tight sm:block">
              <p className="text-xs font-semibold text-slate-800">
                {[usuario?.nombres, usuario?.apellidos].filter(Boolean).join(" ") ||
                  usuario?.email}
              </p>
              <p className="text-[11px] text-slate-500">
                {etiquetaRolUsuario(usuario)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => cerrarSesion(false)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Salir
            </button>
          </div>
        </div>

        {/* Menú móvil */}
        {menuAbierto && (
          <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2 text-xs">
              <div>
                <p className="font-semibold text-slate-900">
                  {[usuario?.nombres, usuario?.apellidos].filter(Boolean).join(" ") ||
                    usuario?.email}
                </p>
                <p className="text-slate-500">
                  {etiquetaRolUsuario(usuario)}
                  {!admin && sedeActiva ? ` · ${sedeActiva.nombre}` : ""}
                </p>
              </div>
            </div>
            <nav className="flex flex-col gap-1" aria-label="Navegación móvil">
              {navItems.map((item) => {
                const active = esActivo(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuAbierto(false)}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium ${
                      active
                        ? "bg-emerald-50 text-emerald-800"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.badge !== undefined && (
                      <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
