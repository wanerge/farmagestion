"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { isApiError } from "@/lib/api/problem";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready, sesion, sedes, iniciarSesion } = useApp();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sesionExpirada = searchParams.get("expirada") === "1";

  useEffect(() => {
    if (ready && sesion) {
      router.replace("/");
    }
  }, [ready, sesion, router]);

  async function manejarSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await iniciarSesion(email, password);
      router.replace("/");
    } catch (err) {
      if (isApiError(err)) {
        setError(err.mensajeUsuario);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("No fue posible iniciar sesión. Intenta nuevamente.");
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-10 text-slate-900">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700 text-sm font-bold text-white">
            FG
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              FarmaGestión S.A.S.
            </p>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Panel de empleados
            </h1>
          </div>
        </div>

        <p className="mt-3 text-sm text-slate-600">
          Inicia sesión con tu cuenta de empleado o administrador para gestionar
          el inventario, los pedidos y la cola de turnos de tu sede.
        </p>

        {sesionExpirada && (
          <div
            role="status"
            className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900"
          >
            Tu sesión expiró. Vuelve a iniciar sesión para continuar.
          </div>
        )}

        <form onSubmit={manejarSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="login-email"
              className="block text-xs font-semibold text-slate-700"
            >
              Correo electrónico
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="farmaceutico.centro@farmagestion.demo"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-xs font-semibold text-slate-700"
            >
              Contraseña
            </label>
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enviando ? "Ingresando…" : "Iniciar sesión"}
          </button>
        </form>

        {/* Acceso directo a pantallas públicas de sala */}
        <div className="mt-6 border-t border-slate-100 pt-5">
          <p className="text-xs font-semibold text-slate-700">
            Pantallas públicas de sala (sin inicio de sesión)
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Solo lectura para televisor en sala de espera, sin datos personales.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(sedes.length > 0
              ? sedes
              : [
                  { codigo: "SEDE-CENTRO", nombre: "Sede Centro" },
                  { codigo: "SEDE-BELLO", nombre: "Sede Bello" },
                  { codigo: "SEDE-ITAGUI", nombre: "Sede Itagüí" },
                ]
            ).map((s) => (
              <Link
                key={s.codigo}
                href={`/sala/${encodeURIComponent(s.codigo ?? "")}`}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
              >
                {s.nombre ?? s.codigo}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-slate-500">
        Simulación académica · Sin datos reales ni validez clínica.
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
          Cargando…
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
