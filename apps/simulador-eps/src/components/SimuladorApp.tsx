"use client";

import { useEffect, useState } from "react";
import { DemoView } from "./DemoView";
import { DetalleFormulaView } from "./DetalleFormulaView";
import { EmitirFormulaView } from "./EmitirFormulaView";
import { FormulasView } from "./FormulasView";
import { PacientesView } from "./PacientesView";

type Tab = "formulas" | "emitir" | "detalle" | "pacientes" | "demo";

export function SimuladorApp() {
  const [verificando, setVerificando] = useState(true);
  const [autenticado, setAutenticado] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [iniciando, setIniciando] = useState(false);

  const [tab, setTab] = useState<Tab>("formulas");
  const [formulaDetalleId, setFormulaDetalleId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/login")
      .then((r) => r.json())
      .then((d) => setAutenticado(Boolean(d.autenticado)))
      .catch(() => setAutenticado(false))
      .finally(() => setVerificando(false));
  }, []);

  async function iniciarSesion(e: React.FormEvent) {
    e.preventDefault();
    setIniciando(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail ?? "Contraseña incorrecta.");
      }
      setAutenticado(true);
      setPassword("");
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : "Error iniciando sesión.");
    } finally {
      setIniciando(false);
    }
  }

  async function cerrarSesion() {
    await fetch("/api/admin/login", { method: "DELETE" });
    setAutenticado(false);
    setTab("formulas");
    setFormulaDetalleId(null);
  }

  if (verificando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Verificando sesión...
      </main>
    );
  }

  if (!autenticado) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-slate-900">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
          <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            Entorno de simulación — sin validez clínica
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">
            Simulador EPS · FarmaGestión
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Ingresa la contraseña de operador para gestionar pacientes y emitir
            fórmulas médicas simuladas.
          </p>

          <form onSubmit={iniciarSesion} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Contraseña de operador
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="••••••••••••"
              />
            </div>

            {loginError && (
              <p className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              disabled={iniciando}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {iniciando ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="bg-amber-100 px-4 py-1.5 text-center text-xs font-semibold text-amber-900">
        DOCUMENTO Y DATOS SIMULADOS — SIN VALIDEZ CLÍNICA NI LEGAL
      </div>

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">
              Simulador EPS · FarmaGestión
            </h1>
          </div>

          <nav className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ["formulas", "Fórmulas"],
                ["emitir", "Emitir fórmula"],
                ["pacientes", "Pacientes"],
                ["demo", "Demo"],
              ] as Array<[Tab, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setTab(key);
                  if (key !== "detalle") setFormulaDetalleId(null);
                }}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  tab === key || (key === "formulas" && tab === "detalle")
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {label}
              </button>
            ))}

            <button
              type="button"
              onClick={cerrarSesion}
              className="ml-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Salir
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {tab === "formulas" && (
          <FormulasView
            onVerDetalle={(id) => {
              setFormulaDetalleId(id);
              setTab("detalle");
            }}
            onNuevaFormula={() => setTab("emitir")}
          />
        )}

        {tab === "emitir" && (
          <EmitirFormulaView
            onFormulaEmitida={(id) => {
              setFormulaDetalleId(id);
              setTab("detalle");
            }}
          />
        )}

        {tab === "detalle" && formulaDetalleId && (
          <DetalleFormulaView
            formulaId={formulaDetalleId}
            onVolver={() => {
              setFormulaDetalleId(null);
              setTab("formulas");
            }}
          />
        )}

        {tab === "pacientes" && <PacientesView />}

        {tab === "demo" && <DemoView />}
      </main>
    </div>
  );
}
