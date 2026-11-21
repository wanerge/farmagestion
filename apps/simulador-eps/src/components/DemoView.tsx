"use client";

import { useState } from "react";

export function DemoView() {
  const [ejecutando, setEjecutando] = useState<"cargar" | "reiniciar" | null>(
    null
  );
  const [resultado, setResultado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cargarDemo() {
    setEjecutando("cargar");
    setError(null);
    setResultado(null);
    try {
      const res = await fetch("/api/admin/demo/cargar", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "No se pudieron cargar los datos demo.");
      setResultado(
        `Datos demo listos: ${data.pacientes} pacientes, ${data.medicos} médicos y ${data.formulasCreadas} fórmulas nuevas creadas (${data.formulasTotalesDemo} fórmulas demo en total).`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando datos demo.");
    } finally {
      setEjecutando(null);
    }
  }

  async function reiniciarDemo() {
    const confirmado = window.confirm(
      "¿Seguro que deseas reiniciar los datos demo? Se eliminarán todas las fórmulas y dispensaciones actuales y se volverán a crear los datos de demostración."
    );
    if (!confirmado) return;

    setEjecutando("reiniciar");
    setError(null);
    setResultado(null);
    try {
      const res = await fetch("/api/admin/demo/reiniciar", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "No se pudo reiniciar la demo.");
      setResultado(
        `Demo reiniciada: ${data.pacientes} pacientes, ${data.medicos} médicos y ${data.formulasCreadas} fórmulas restauradas.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error reiniciando demo.");
    } finally {
      setEjecutando(null);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">
        Datos de demostración
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Carga 5 pacientes ficticios (coincidentes con la semilla de FarmaGestión),
        4 médicos y 8 fórmulas variadas, incluyendo una próxima a vencer, una ya
        vencida y una parcialmente dispensada.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={ejecutando !== null}
          onClick={cargarDemo}
          className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {ejecutando === "cargar" ? "Cargando..." : "Cargar datos demo"}
        </button>

        <button
          type="button"
          disabled={ejecutando !== null}
          onClick={reiniciarDemo}
          className="rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          {ejecutando === "reiniciar" ? "Reiniciando..." : "Reiniciar demo"}
        </button>
      </div>

      {resultado && (
        <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          {resultado}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
