"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "./AppProvider";

export function PacienteGuard({ children }: { children: React.ReactNode }) {
  const { ready, sesion } = useApp();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!ready) return;
    if (!sesion) {
      const destino = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${destino}`);
    }
  }, [ready, sesion, router, pathname]);

  if (!ready || !sesion) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
          <span>Verificando sesión…</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
