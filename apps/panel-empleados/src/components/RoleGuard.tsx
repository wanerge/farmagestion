"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { UsuarioResumen } from "@/lib/api/client";
import { etiquetaRolUsuario } from "@/lib/auth/permisos";
import { useApp } from "./AppProvider";
import { PanelShell } from "./PanelShell";

interface RoleGuardProps {
  children: React.ReactNode;
  permitido?: (usuario: UsuarioResumen) => boolean;
  mensajeDenegado?: string;
}

export function RoleGuard({
  children,
  permitido,
  mensajeDenegado = "Tu cargo actual no tiene permisos para acceder a esta sección.",
}: RoleGuardProps) {
  const router = useRouter();
  const { ready, sesion } = useApp();

  useEffect(() => {
    if (ready && !sesion) {
      router.replace("/login");
    }
  }, [ready, sesion, router]);

  if (!ready || !sesion) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Verificando sesión…
      </div>
    );
  }

  if (permitido && !permitido(sesion.usuario)) {
    return (
      <PanelShell>
        <div className="mx-auto max-w-lg rounded-xl border border-amber-200 bg-white p-6 shadow-sm">
          <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
            Acceso restringido · {etiquetaRolUsuario(sesion.usuario)}
          </span>
          <h1 className="mt-3 text-lg font-bold text-slate-900">
            No tienes permisos para esta pantalla
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">{mensajeDenegado}</p>
          <div className="mt-5 flex gap-3">
            <Link
              href="/"
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
            >
              Volver al tablero
            </Link>
            <Link
              href="/notificaciones"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Ver notificaciones
            </Link>
          </div>
        </div>
      </PanelShell>
    );
  }

  return <PanelShell>{children}</PanelShell>;
}
