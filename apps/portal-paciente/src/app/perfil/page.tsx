"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { PacienteGuard } from "@/components/PacienteGuard";
import { portalApi, type PerfilPaciente } from "@/lib/api/client";
import { isApiError } from "@/lib/api/problem";

function ContenidoPerfil() {
  const { sesion, cerrarSesion, mostrarExito } = useApp();
  const token = sesion?.accessToken ?? "";

  const [perfil, setPerfil] = useState<PerfilPaciente | null>(null);
  const [cargando, setCargando] = useState(true);

  const [telefono, setTelefono] = useState("");
  const [guardandoTel, setGuardandoTel] = useState(false);
  const [errorTel, setErrorTel] = useState<string | null>(null);

  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [confirmarNueva, setConfirmarNueva] = useState("");
  const [guardandoPwd, setGuardandoPwd] = useState(false);
  const [errorPwd, setErrorPwd] = useState<string | null>(null);

  const cargarPerfil = useCallback(async () => {
    if (!token) return;
    setCargando(true);
    try {
      const data = await portalApi.obtenerPerfil({ token });
      setPerfil(data);
      setTelefono(data.telefono ?? "");
    } catch {
      // Error global ya notificado
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void cargarPerfil();
    }, 0);
    return () => window.clearTimeout(id);
  }, [cargarPerfil]);

  const manejarGuardarTelefono = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorTel(null);
    if (!telefono.trim()) {
      setErrorTel("Ingresa un número de teléfono válido.");
      return;
    }
    setGuardandoTel(true);
    try {
      const actualizado = await portalApi.actualizarPerfil(
        { telefono: telefono.trim() },
        { token, notifyGlobalError: false }
      );
      setPerfil(actualizado);
      setTelefono(actualizado.telefono ?? "");
      mostrarExito("Perfil actualizado", "Tu número de teléfono fue guardado.");
    } catch (err) {
      setErrorTel(
        isApiError(err) ? err.mensajeUsuario : "No fue posible actualizar el teléfono."
      );
    } finally {
      setGuardandoTel(false);
    }
  };

  const manejarCambiarPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorPwd(null);
    if (!passwordActual) {
      setErrorPwd("Ingresa tu contraseña actual.");
      return;
    }
    if (passwordNueva.length < 8) {
      setErrorPwd("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (passwordNueva !== confirmarNueva) {
      setErrorPwd("La confirmación de la nueva contraseña no coincide.");
      return;
    }

    setGuardandoPwd(true);
    try {
      await portalApi.actualizarPerfil(
        {
          passwordActual,
          passwordNueva,
        },
        { token, notifyGlobalError: false }
      );
      setPasswordActual("");
      setPasswordNueva("");
      setConfirmarNueva("");
      mostrarExito(
        "Contraseña actualizada",
        "Tu contraseña se cambió correctamente."
      );
    } catch (err) {
      setErrorPwd(
        isApiError(err)
          ? err.mensajeUsuario
          : "No fue posible cambiar la contraseña."
      );
    } finally {
      setGuardandoPwd(false);
    }
  };

  if (cargando) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        <div className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
            Mi perfil
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Consulta tus datos registrados y actualiza tu teléfono o contraseña.
          </p>
        </div>
        <button
          type="button"
          onClick={() => cerrarSesion(false)}
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100"
        >
          Cerrar sesión
        </button>
      </div>

      {/* Datos de identidad (solo lectura; documento no editable por RF-PAC-03) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="text-base font-bold text-slate-900">
          Datos del paciente
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          El documento de identidad no es editable porque se usa para validar tus
          fórmulas médicas con la EPS.
        </p>

        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-[11px] font-semibold text-slate-500 uppercase">
              Nombre completo
            </dt>
            <dd className="mt-0.5 font-semibold text-slate-900">
              {perfil?.nombres} {perfil?.apellidos}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-[11px] font-semibold text-slate-500 uppercase">
              Documento (no editable)
            </dt>
            <dd className="mt-0.5 font-mono font-semibold text-slate-900">
              {perfil?.tipoDocumento} {perfil?.documento}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 sm:col-span-2">
            <dt className="text-[11px] font-semibold text-slate-500 uppercase">
              Correo electrónico
            </dt>
            <dd className="mt-0.5 font-medium text-slate-800">
              {perfil?.email}
            </dd>
          </div>
        </dl>
      </section>

      {/* Editar teléfono (RF-PAC-03) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="text-base font-bold text-slate-900">
          Teléfono de contacto
        </h2>

        {errorTel && (
          <div
            role="alert"
            className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-900"
          >
            {errorTel}
          </div>
        )}

        <form onSubmit={manejarGuardarTelefono} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="perfil-telefono"
              className="block text-xs font-semibold text-slate-700"
            >
              Teléfono
            </label>
            <input
              id="perfil-telefono"
              type="tel"
              required
              maxLength={30}
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
          <button
            type="submit"
            disabled={guardandoTel}
            className="rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-teal-800 disabled:opacity-60"
          >
            {guardandoTel ? "Guardando…" : "Guardar teléfono"}
          </button>
        </form>
      </section>

      {/* Cambiar contraseña (RF-PAC-03) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="text-base font-bold text-slate-900">
          Cambiar contraseña
        </h2>

        {errorPwd && (
          <div
            role="alert"
            className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-900"
          >
            {errorPwd}
          </div>
        )}

        <form onSubmit={manejarCambiarPassword} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="pwd-actual"
              className="block text-xs font-semibold text-slate-700"
            >
              Contraseña actual
            </label>
            <input
              id="pwd-actual"
              type="password"
              required
              autoComplete="current-password"
              value={passwordActual}
              onChange={(e) => setPasswordActual(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="pwd-nueva"
                className="block text-xs font-semibold text-slate-700"
              >
                Nueva contraseña (mín. 8 caracteres)
              </label>
              <input
                id="pwd-nueva"
                type="password"
                required
                minLength={8}
                maxLength={100}
                autoComplete="new-password"
                value={passwordNueva}
                onChange={(e) => setPasswordNueva(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>

            <div>
              <label
                htmlFor="pwd-confirmar"
                className="block text-xs font-semibold text-slate-700"
              >
                Confirmar nueva contraseña
              </label>
              <input
                id="pwd-confirmar"
                type="password"
                required
                minLength={8}
                maxLength={100}
                autoComplete="new-password"
                value={confirmarNueva}
                onChange={(e) => setConfirmarNueva(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={guardandoPwd}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-slate-800 disabled:opacity-60"
          >
            {guardandoPwd ? "Actualizando…" : "Actualizar contraseña"}
          </button>
        </form>
      </section>
    </div>
  );
}

export default function PerfilPage() {
  return (
    <PacienteGuard>
      <ContenidoPerfil />
    </PacienteGuard>
  );
}
