"use client";

import { useCallback, useEffect, useState } from "react";

export interface PacienteItem {
  id: string;
  tipoDocumento: string;
  documento: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
  eps: string;
  telefono: string | null;
}

const EMPTY_FORM = {
  tipoDocumento: "CC",
  documento: "",
  nombres: "",
  apellidos: "",
  fechaNacimiento: "1990-01-01",
  eps: "Salud Antioquia EPS (Simulada)",
  telefono: "",
};

export function PacientesView() {
  const [pacientes, setPacientes] = useState<PacienteItem[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async (q: string) => {
    setCargando(true);
    setError(null);
    try {
      const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      const res = await fetch(`/api/admin/pacientes${qs}`);
      if (!res.ok) throw new Error("No se pudieron cargar los pacientes.");
      const data = await res.json();
      setPacientes(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando pacientes.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar("");
  }, [cargar]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    setMensaje(null);
    try {
      const url = editandoId
        ? `/api/admin/pacientes/${editandoId}`
        : "/api/admin/pacientes";
      const method = editandoId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail ?? "No se pudo guardar el paciente.");
      }
      setMensaje(
        editandoId
          ? "Paciente actualizado correctamente."
          : "Paciente registrado correctamente."
      );
      setEditandoId(null);
      setForm(EMPTY_FORM);
      await cargar(busqueda);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setGuardando(false);
    }
  }

  function iniciarEdicion(p: PacienteItem) {
    setEditandoId(p.id);
    setForm({
      tipoDocumento: p.tipoDocumento,
      documento: p.documento,
      nombres: p.nombres,
      apellidos: p.apellidos,
      fechaNacimiento: p.fechaNacimiento,
      eps: p.eps,
      telefono: p.telefono ?? "",
    });
    setMensaje(null);
    setError(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1">
        <h2 className="text-lg font-semibold text-slate-900">
          {editandoId ? "Editar paciente" : "Nuevo paciente"}
        </h2>
        <form onSubmit={guardar} className="mt-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Tipo
              </label>
              <select
                value={form.tipoDocumento}
                onChange={(e) =>
                  setForm({ ...form, tipoDocumento: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
              >
                <option value="CC">CC</option>
                <option value="TI">TI</option>
                <option value="CE">CE</option>
                <option value="PA">PA</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-700">
                Documento
              </label>
              <input
                required
                value={form.documento}
                onChange={(e) =>
                  setForm({ ...form, documento: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="1000000001"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">
              Nombres
            </label>
            <input
              required
              value={form.nombres}
              onChange={(e) => setForm({ ...form, nombres: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">
              Apellidos
            </label>
            <input
              required
              value={form.apellidos}
              onChange={(e) => setForm({ ...form, apellidos: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">
              Fecha de nacimiento
            </label>
            <input
              type="date"
              required
              value={form.fechaNacimiento}
              onChange={(e) =>
                setForm({ ...form, fechaNacimiento: e.target.value })
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">
              EPS simulada
            </label>
            <input
              required
              value={form.eps}
              onChange={(e) => setForm({ ...form, eps: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">
              Teléfono
            </label>
            <input
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">
              {error}
            </p>
          )}
          {mensaje && (
            <p className="rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-700">
              {mensaje}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={guardando}
              className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {guardando
                ? "Guardando..."
                : editandoId
                  ? "Guardar cambios"
                  : "Registrar paciente"}
            </button>
            {editandoId && (
              <button
                type="button"
                onClick={() => {
                  setEditandoId(null);
                  setForm(EMPTY_FORM);
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Pacientes registrados ({pacientes.length})
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void cargar(busqueda);
            }}
            className="flex gap-2"
          >
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por documento o nombre..."
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
            >
              Buscar
            </button>
          </form>
        </div>

        <div className="mt-4 overflow-x-auto">
          {cargando ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Cargando pacientes...
            </p>
          ) : pacientes.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No hay pacientes registrados. Puedes crear uno o cargar los datos
              demo.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Documento</th>
                  <th className="py-2 pr-3">Nombre</th>
                  <th className="py-2 pr-3">EPS</th>
                  <th className="py-2 pr-3">Teléfono</th>
                  <th className="py-2 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pacientes.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2.5 pr-3 font-mono text-xs">
                      {p.tipoDocumento} {p.documento}
                    </td>
                    <td className="py-2.5 pr-3 font-medium text-slate-900">
                      {p.nombres} {p.apellidos}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600">{p.eps}</td>
                    <td className="py-2.5 pr-3 text-slate-600">
                      {p.telefono ?? "—"}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => iniciarEdicion(p)}
                        className="text-xs font-medium text-sky-700 hover:underline"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
