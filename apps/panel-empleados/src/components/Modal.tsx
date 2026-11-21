"use client";

import { useEffect } from "react";

interface ModalProps {
  abierto: boolean;
  titulo: string;
  descripcion?: string;
  onCerrar: () => void;
  children: React.ReactNode;
}

export function Modal({
  abierto,
  titulo,
  descripcion,
  onCerrar,
  children,
}: ModalProps) {
  useEffect(() => {
    if (!abierto) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-titulo"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="modal-titulo" className="text-lg font-bold text-slate-900">
              {titulo}
            </h2>
            {descripcion && (
              <p className="mt-1 text-sm text-slate-600">{descripcion}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar ventana"
          >
            ✕
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}
