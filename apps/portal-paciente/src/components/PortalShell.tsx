"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "./AppProvider";

function Icono({
  nombre,
  activo,
}: {
  nombre: "buscar" | "sedes" | "formulas" | "pedidos" | "alertas" | "perfil" | "login";
  activo?: boolean;
}) {
  const cls = `h-5 w-5 ${activo ? "text-teal-700" : "text-slate-500"}`;
  switch (nombre) {
    case "buscar":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
      );
    case "sedes":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    case "formulas":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
          <path d="M14 3v5h5M9 13h6M9 17h4" strokeLinecap="round" />
        </svg>
      );
    case "pedidos":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M6 7h12l1 13H5L6 7Z" />
          <path d="M9 7V5a3 3 0 0 1 6 0v2" />
        </svg>
      );
    case "alertas":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8Z" />
          <path d="M10.3 20a2 2 0 0 0 3.4 0" strokeLinecap="round" />
        </svg>
      );
    case "perfil":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="8" r="4" />
          <path d="M5 20a7 7 0 0 1 14 0" strokeLinecap="round" />
        </svg>
      );
    case "login":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" strokeLinecap="round" />
          <path d="M10 17l5-5-5-5M15 12H3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { sesion, noLeidas, cerrarSesion } = useApp();

  const estaActivo = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname?.startsWith(`${href}/`);
  };

  const navDesktop = sesion
    ? [
        { href: "/", label: "Medicamentos" },
        { href: "/sedes", label: "Sedes" },
        { href: "/formulas", label: "Mis fórmulas" },
        { href: "/pedidos", label: "Mis pedidos" },
        { href: "/notificaciones", label: "Notificaciones", badge: noLeidas },
      ]
    : [
        { href: "/", label: "Medicamentos" },
        { href: "/sedes", label: "Sedes" },
      ];

  const navMovil: Array<{
    href: string;
    label: string;
    icono: "buscar" | "sedes" | "formulas" | "pedidos" | "alertas" | "login";
    badge?: number;
  }> = sesion
    ? [
        { href: "/", label: "Buscar", icono: "buscar" },
        { href: "/sedes", label: "Sedes", icono: "sedes" },
        { href: "/formulas", label: "Fórmulas", icono: "formulas" },
        { href: "/pedidos", label: "Pedidos", icono: "pedidos" },
        { href: "/notificaciones", label: "Alertas", icono: "alertas", badge: noLeidas },
      ]
    : [
        { href: "/", label: "Buscar", icono: "buscar" },
        { href: "/sedes", label: "Sedes", icono: "sedes" },
        { href: "/login", label: "Ingresar", icono: "login" },
      ];

  const nombreCorto = sesion?.usuario?.nombres?.split(" ")[0] ?? "Mi cuenta";

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      {/* Cabecera superior */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700 text-sm font-bold text-white shadow-sm">
              FG
            </span>
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-tight text-slate-900 sm:text-base">
                FarmaGestión
              </p>
              <p className="text-[11px] font-medium text-teal-700">
                Portal del paciente
              </p>
            </div>
          </Link>

          {/* Navegación escritorio */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Principal">
            {navDesktop.map((item) => {
              const activo = estaActivo(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    activo
                      ? "bg-teal-50 text-teal-800"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Acciones de cuenta */}
          <div className="flex items-center gap-2">
            {sesion ? (
              <>
                <Link
                  href="/perfil"
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition sm:text-sm ${
                    estaActivo("/perfil")
                      ? "border-teal-300 bg-teal-50 text-teal-800"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Icono nombre="perfil" activo={estaActivo("/perfil")} />
                  <span className="max-w-[90px] truncate sm:max-w-[140px]">
                    {nombreCorto}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => cerrarSesion(false)}
                  className="hidden rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 sm:inline-flex"
                >
                  Salir
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:text-sm"
                >
                  Ingresar
                </Link>
                <Link
                  href="/registro"
                  className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-teal-800 sm:text-sm"
                >
                  Crear cuenta
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Contenido principal con espacio inferior en móvil para la barra inferior */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-24 sm:px-6 md:pb-10">
        {children}
      </main>

      {/* Pie discreto en escritorio */}
      <footer className="hidden border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500 md:block">
        FarmaGestión S.A.S. · Simulación académica — datos y fórmulas ficticias sin validez clínica.
      </footer>

      {/* Navegación inferior mobile-first */}
      <nav
        aria-label="Navegación móvil"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden"
      >
        <div
          className={`mx-auto grid max-w-lg ${
            navMovil.length === 5 ? "grid-cols-5" : "grid-cols-3"
          }`}
        >
          {navMovil.map((item) => {
            const activo = estaActivo(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition ${
                  activo ? "text-teal-700" : "text-slate-500"
                }`}
              >
                <div className="relative">
                  <Icono nombre={item.icono} activo={activo} />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 inline-flex min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </div>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
