export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-8 text-slate-900">
      <div className="max-w-lg rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
          Entorno de simulación
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">
          Simulador EPS · FarmaGestión
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Servicio de emisión y consulta de fórmulas médicas simuladas sin
          validez clínica ni legal.
        </p>
      </div>
    </main>
  );
}
