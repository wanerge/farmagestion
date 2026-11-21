export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-8 text-slate-900">
      <div className="max-w-lg rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
          FarmaGestión S.A.S.
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">
          Portal del paciente
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Consulta disponibilidad de medicamentos, vincula tus fórmulas y agenda
          tu turno o domicilio.
        </p>
      </div>
    </main>
  );
}
