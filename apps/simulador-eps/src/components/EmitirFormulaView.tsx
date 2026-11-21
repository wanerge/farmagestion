"use client";

import { useEffect, useState } from "react";
import type { PacienteItem } from "./PacientesView";

interface MedicoItem {
  id: string;
  nombre: string;
  registro: string;
  especialidad: string;
}

interface MedicamentoItem {
  codigo: string;
  nombre: string;
  principioActivo: string;
  presentacion: string;
}

interface ItemRow {
  medicamentoCodigo: string;
  dosis: string;
  frecuencia: string;
  duracionDias: number;
  cantidadAutorizada: number;
}

export function EmitirFormulaView({
  onFormulaEmitida,
}: {
  onFormulaEmitida: (formulaId: string) => void;
}) {
  const [pacientes, setPacientes] = useState<PacienteItem[]>([]);
  const [medicos, setMedicos] = useState<MedicoItem[]>([]);
  const [medicamentos, setMedicamentos] = useState<MedicamentoItem[]>([]);
  const [pacienteId, setPacienteId] = useState("");
  const [medicoId, setMedicoId] = useState("");
  const [vigenciaDias, setVigenciaDias] = useState(30);
  const [observaciones, setObservaciones] = useState("");
  const [items, setItems] = useState<ItemRow[]>([
    {
      medicamentoCodigo: "",
      dosis: "1 tableta",
      frecuencia: "cada 12 horas",
      duracionDias: 30,
      cantidadAutorizada: 30,
    },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    async function cargarCatalogos() {
      const [resP, resMed, resCat] = await Promise.all([
        fetch("/api/admin/pacientes"),
        fetch("/api/admin/medicos"),
        fetch("/api/admin/medicamentos"),
      ]);
      const [pData, mData, cData] = await Promise.all([
        resP.json(),
        resMed.json(),
        resCat.json(),
      ]);
      setPacientes(pData.items ?? []);
      setMedicos(mData.items ?? []);
      setMedicamentos(cData.items ?? []);
      if (pData.items?.[0]) setPacienteId(pData.items[0].id);
      if (mData.items?.[0]) setMedicoId(mData.items[0].id);
      if (cData.items?.[0]) {
        setItems((prev) => [
          { ...prev[0], medicamentoCodigo: cData.items[0].codigo },
        ]);
      }
    }
    void cargarCatalogos();
  }, []);

  function actualizarItem(index: number, patch: Partial<ItemRow>) {
    setItems((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row))
    );
  }

  function agregarItem() {
    if (items.length >= 10) return;
    const usados = new Set(items.map((i) => i.medicamentoCodigo));
    const siguiente =
      medicamentos.find((m) => !usados.has(m.codigo))?.codigo ??
      medicamentos[0]?.codigo ??
      "";
    setItems([
      ...items,
      {
        medicamentoCodigo: siguiente,
        dosis: "1 tableta",
        frecuencia: "cada 24 horas",
        duracionDias: 30,
        cantidadAutorizada: 30,
      },
    ]);
  }

  function eliminarItem(index: number) {
    if (items.length <= 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  }

  async function emitir(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/formulas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pacienteId,
          medicoId,
          vigenciaDias,
          observaciones: observaciones.trim() || null,
          items,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail ?? "No se pudo emitir la fórmula.");
      }
      onFormulaEmitida(data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al emitir fórmula.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={emitir}
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-slate-900">
        Emitir nueva fórmula médica
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        El código se genera automáticamente (FRM-AÑO-SECUENCIAL) y el documento
        se emite en estado EMITIDA.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-slate-700">
            Paciente
          </label>
          <select
            required
            value={pacienteId}
            onChange={(e) => setPacienteId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Seleccione un paciente...</option>
            {pacientes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.tipoDocumento} {p.documento} — {p.nombres} {p.apellidos}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700">
            Médico prescriptor
          </label>
          <select
            required
            value={medicoId}
            onChange={(e) => setMedicoId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Seleccione un médico...</option>
            {medicos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre} ({m.especialidad})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700">
            Vigencia (días)
          </label>
          <input
            type="number"
            min={1}
            max={365}
            required
            value={vigenciaDias}
            onChange={(e) => setVigenciaDias(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">
            Medicamentos ({items.length}/10)
          </h3>
          <button
            type="button"
            disabled={items.length >= 10}
            onClick={agregarItem}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            + Agregar medicamento
          </button>
        </div>

        <div className="mt-3 space-y-3">
          {items.map((row, idx) => (
            <div
              key={idx}
              className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-12"
            >
              <div className="md:col-span-4">
                <label className="block text-[11px] font-medium text-slate-600">
                  Medicamento
                </label>
                <select
                  required
                  value={row.medicamentoCodigo}
                  onChange={(e) =>
                    actualizarItem(idx, { medicamentoCodigo: e.target.value })
                  }
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
                >
                  {medicamentos.map((m) => (
                    <option key={m.codigo} value={m.codigo}>
                      {m.codigo} — {m.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] font-medium text-slate-600">
                  Dosis
                </label>
                <input
                  required
                  value={row.dosis}
                  onChange={(e) =>
                    actualizarItem(idx, { dosis: e.target.value })
                  }
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] font-medium text-slate-600">
                  Frecuencia
                </label>
                <input
                  required
                  value={row.frecuencia}
                  onChange={(e) =>
                    actualizarItem(idx, { frecuencia: e.target.value })
                  }
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-[11px] font-medium text-slate-600">
                  Días
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={row.duracionDias}
                  onChange={(e) =>
                    actualizarItem(idx, {
                      duracionDias: Number(e.target.value),
                    })
                  }
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] font-medium text-slate-600">
                  Cant. autorizada
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={row.cantidadAutorizada}
                  onChange={(e) =>
                    actualizarItem(idx, {
                      cantidadAutorizada: Number(e.target.value),
                    })
                  }
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
                />
              </div>
              <div className="flex items-end md:col-span-1">
                <button
                  type="button"
                  disabled={items.length <= 1}
                  onClick={() => eliminarItem(idx)}
                  className="w-full rounded border border-red-200 px-2 py-1.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-30"
                >
                  Quitar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-xs font-medium text-slate-700">
          Observaciones (opcional)
        </label>
        <textarea
          rows={2}
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Indicaciones generales de control..."
        />
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-5 flex justify-end">
        <button
          type="submit"
          disabled={enviando || pacientes.length === 0}
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {enviando ? "Emitiendo..." : "Emitir fórmula"}
        </button>
      </div>
    </form>
  );
}
