"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { isApiError } from "@/lib/api/problem";

function FormularioLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready, sesion, iniciarSesion } = useApp();

  const expirada = searchParams.get("expirada") === "1";
  const nextParam = searchParams.get("next");
  const destino =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/formulas";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (ready && sesion) {
      router.replace(destino);
    }
  }, [ready, sesion, router, destino]);

  const manejarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setEnviando(true);
    try {
      await iniciarSesion(email, password);
      router.replace(destino);
    } catch (err) {
      if (isApiError(err)) {
        setErrorMsg(err.mensajeUsuario);
      } else if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("No fue posible iniciar sesión. Intenta nuevamente.");
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mx-auto max-w-md py-4 sm:py-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-700 text-base font-bold text-white shadow-sm">
            FG
          </span>
          <h1 className="mt-3 text-xl font-bold text-slate-900">
            Inicia sesión
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Accede a tus fórmulas médicas, pedidos y turnos en FarmaGestión.
          </p>
        </div>

        {expirada && (
          <div
            role="status"
            className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900"
          >
            Tu sesión expiró por seguridad (vigencia de 2 horas). Inicia sesión de
            nuevo para continuar.
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-900"
          >
            {errorMsg}
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
              placeholder="paciente1@farmagestion.demo"
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
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
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-xl bg-teal-700 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enviando ? "Ingresando…" : "Iniciar sesión"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-600">
          ¿Aún no tienes cuenta?{" "}
          <Link
            href="/registro"
            className="font-semibold text-teal-700 hover:text-teal-800"
          >
            Regístrate aquí
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md py-8">
          <div className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        </div>
      }
    >
      <FormularioLogin />
    </Suspense>
  );
}
