"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { isApiError } from "@/lib/api/problem";
import { TIPOS_DOCUMENTO } from "@/lib/format";

export default function RegistroPage() {
  const router = useRouter();
  const { ready, sesion, registrarPaciente, mostrarExito } = useApp();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState<string>("CC");
  const [documento, setDocumento] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [telefono, setTelefono] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [erroresCampos, setErroresCampos] = useState<Record<string, string>>({});

  useEffect(() => {
    if (ready && sesion) {
      router.replace("/formulas");
    }
  }, [ready, sesion, router]);

  const manejarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setErroresCampos({});

    if (password.length < 8) {
      setErrorMsg("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmarPassword) {
      setErrorMsg("Las contraseñas no coinciden.");
      return;
    }

    setEnviando(true);
    try {
      await registrarPaciente({
        email: email.trim(),
        password,
        tipoDocumento,
        documento: documento.trim(),
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        telefono: telefono.trim(),
      });
      mostrarExito(
        "Cuenta creada",
        "Ya puedes vincular tus fórmulas y agendar turnos en sede."
      );
      router.replace("/formulas");
    } catch (err) {
      if (isApiError(err)) {
        setErrorMsg(err.mensajeUsuario);
        if (err.erroresCampos) {
          setErroresCampos(err.erroresCampos);
        }
      } else if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("No fue posible completar el registro.");
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg py-2 sm:py-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Registro de paciente
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Usa el mismo documento registrado en tu EPS para vincular tus
            fórmulas médicas. El documento no podrá cambiarse después.
          </p>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900"
          >
            <p className="font-semibold">{errorMsg}</p>
            {Object.keys(erroresCampos).length > 0 && (
              <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
                {Object.entries(erroresCampos).map(([campo, msg]) => (
                  <li key={campo}>
                    <span className="font-medium">{campo}:</span> {msg}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <form onSubmit={manejarSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="reg-tipo-doc"
                className="block text-xs font-semibold text-slate-700"
              >
                Tipo de documento
              </label>
              <select
                id="reg-tipo-doc"
                value={tipoDocumento}
                onChange={(e) => setTipoDocumento(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              >
                {TIPOS_DOCUMENTO.map((t) => (
                  <option key={t.codigo} value={t.codigo}>
                    {t.etiqueta}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="reg-documento"
                className="block text-xs font-semibold text-slate-700"
              >
                Número de documento
              </label>
              <input
                id="reg-documento"
                type="text"
                required
                maxLength={30}
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                placeholder="Ej. 1000000010"
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="reg-nombres"
                className="block text-xs font-semibold text-slate-700"
              >
                Nombres
              </label>
              <input
                id="reg-nombres"
                type="text"
                required
                maxLength={120}
                value={nombres}
                onChange={(e) => setNombres(e.target.value)}
                placeholder="Ana María"
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>

            <div>
              <label
                htmlFor="reg-apellidos"
                className="block text-xs font-semibold text-slate-700"
              >
                Apellidos
              </label>
              <input
                id="reg-apellidos"
                type="text"
                required
                maxLength={120}
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value)}
                placeholder="Ríos Gómez"
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="reg-email"
                className="block text-xs font-semibold text-slate-700"
              >
                Correo electrónico
              </label>
              <input
                id="reg-email"
                type="email"
                required
                autoComplete="email"
                maxLength={255}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>

            <div>
              <label
                htmlFor="reg-telefono"
                className="block text-xs font-semibold text-slate-700"
              >
                Teléfono
              </label>
              <input
                id="reg-telefono"
                type="tel"
                required
                maxLength={30}
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="3001234567"
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="reg-password"
                className="block text-xs font-semibold text-slate-700"
              >
                Contraseña (mín. 8 caracteres)
              </label>
              <input
                id="reg-password"
                type="password"
                required
                minLength={8}
                maxLength={100}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>

            <div>
              <label
                htmlFor="reg-password-confirm"
                className="block text-xs font-semibold text-slate-700"
              >
                Confirmar contraseña
              </label>
              <input
                id="reg-password-confirm"
                type="password"
                required
                minLength={8}
                maxLength={100}
                autoComplete="new-password"
                value={confirmarPassword}
                onChange={(e) => setConfirmarPassword(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-xl bg-teal-700 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enviando ? "Creando cuenta…" : "Crear cuenta de paciente"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-600">
          ¿Ya tienes cuenta?{" "}
          <Link
            href="/login"
            className="font-semibold text-teal-700 hover:text-teal-800"
          >
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
