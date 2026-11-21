"use client";

import { useCallback, useEffect, useState } from "react";
import type { PacienteItem } from "./PacientesView";

interface FormulaResumen {
  id: string;
  codigo: string;
  estado: string;
  fechaEmision: string;
  fechaVencimiento: string;
  totalItems: number;
  paciente: {
    id: string;
    tipoDocumento: string;
    documento: string;
    nombres: string;
    apellidos: string;
  };
  medico: {
    nombre: string;
  };
}

export function badgeEstado(estado: string): string {
  switch (estado) {
    case "EMITIDA":
      return "bg-emerald-100 text-emerald-800";
    case "PARCIALMENTE_DISPENSADA":
      return "bg-sky-100 text-sky-800";
    case "DISPENSADA":
      return "bg-slate-200 text-slate-800";
    case "VENCIDA":
      return "bg-amber-100 text-amber-800";
    case "ANULADA":
      return "bg-red-100 text-red-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export function FormulasView({
  onVerDetalle,
  onNuevaFormula,
}: {
  onVerDetalle: (id: string) => void;
  onNuevaFormula: () => void;
}) {
  const [formulas, setFormulas] = useState<FormulaResumen[]>([]);
  const [pacientes, setPacientes] = useState<PacienteItem[]>([]);
  const [estado, setEstado] = useState("");
  const [pacienteId, setPacienteId] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    const params = new URLSearchParams();
    if (estado) params.set("estado", estado);
    if (pacienteId) params.set("pacienteId", pacienteId);
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);

    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`/api/admin/formulas${qs}`);
    const data = await res.json();
    setFormulas(data.items ?? []);
    setCargando(false);
  }, [estado, pacienteId, desde, hasta]);

  useEffect(() => {
    fetch("/api/admin/pacientes")
      .then((r) => r.json())
      .then((d) => setPacientes(d.items ?? []));
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-900">
          Fórmulas emitidas ({formulas.length})
        </h2>
        <button
          type="button"
          onClick={onNuevaFormula}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + Emitir fórmula
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <div>
          <label className="block text-xs font-medium text-slate-600">
            Estado
          </label>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
          >
            <option value="">Todos</option>
            <option value="EMITIDA">EMITIDA</option>
            <option value="PARCIALMENTE_DISPENSADA">
              PARCIALMENTE_DISPENSADA
            </option>
            <option value="DISPENSADA">DISPENSADA</option>
            <option value="VENCIDA">VENCIDA</option>
            <option value="ANULADA">ANULADA</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600">
            Paciente
          </label>
          <select
            value={pacienteId}
            onChange={(e) => setPacienteId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
          >
            <option value="">Todos</option>
            {pacientes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.documento} — {p.nombres} {p.apellidos}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600">
            Emitida desde
          </label>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600">
            Emitida hasta
          </label>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        {cargando ? (
          <p className="py-8 text-center text-sm text-slate-500">
            Cargando fórmulas...
          </p>
        ) : formulas.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            No se encontraron fórmulas con los filtros actuales.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-3">Código</th>
                <th className="py-2 pr-3">Paciente</th>
                <th className="py-2 pr-3">Emisión</th>
                <th className="py-2 pr-3">Vencimiento</th>
                <th className="py-2 pr-3">Ítems</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {formulas.map((f) => (
                <tr key={f.id}>
                  <td className="py-2.5 pr-3 font-mono text-xs font-semibold text-slate-900">
                    {f.codigo}
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="font-medium text-slate-900">
                      {f.paciente.nombres} {f.paciente.apellidos}
                    </div>
                    <div className="text-xs text-slate-500">
                      {f.paciente.tipoDocumento} {f.paciente.documento}
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-slate-600">
                    {f.fechaEmision}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-600">
                    {f.fechaVencimiento}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-600">{f.totalItems}</td>
                  <td className="py-2.5 pr-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeEstado(
                        f.estado
                      )}`}
                    >
                      {f.estado}
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => onVerDetalle(f.id)}
                      className="text-xs font-medium text-sky-700 hover:underline"
                    >
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
