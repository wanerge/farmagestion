import type {
  EstadoPedido,
  EstadoRuta,
  EstadoRutaParada,
  EstadoTurno,
  ModalidadPedido,
  NivelDisponibilidad,
  TipoMovimiento,
} from "./api/client";

const ZONA_BOGOTA = "America/Bogota";

export function fechaHoyBogota(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_BOGOTA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === "year")?.value ?? "2026";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function formatearFechaHora(iso?: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: ZONA_BOGOTA,
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function formatearHora(valor?: string | null): string {
  if (!valor) return "—";
  // Si viene como HH:mm:ss (time-local)
  if (/^\d{2}:\d{2}/.test(valor)) {
    return valor.slice(0, 5);
  }
  const date = new Date(valor);
  if (Number.isNaN(date.getTime())) return valor;
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: ZONA_BOGOTA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatearTiempoRestante(iso?: string | null): {
  texto: string;
  urgente: boolean;
  vencido: boolean;
} {
  if (!iso) return { texto: "Sin vencimiento", urgente: false, vencido: false };
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return { texto: iso, urgente: false, vencido: false };

  const diffMin = Math.round((target - Date.now()) / 60_000);
  if (diffMin <= 0) {
    return { texto: "Expirado", urgente: true, vencido: true };
  }
  if (diffMin < 60) {
    return { texto: `Vence en ${diffMin} min`, urgente: diffMin <= 30, vencido: false };
  }
  const horas = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  return {
    texto: mins > 0 ? `Vence en ${horas} h ${mins} min` : `Vence en ${horas} h`,
    urgente: horas < 2,
    vencido: false,
  };
}

export const ETIQUETA_ESTADO_PEDIDO: Record<EstadoPedido, string> = {
  RESERVADO: "Reservado",
  EN_PREPARACION: "En preparación",
  LISTO: "Listo",
  EN_RUTA: "En ruta",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
  VENCIDO: "Vencido",
};

export const CLASE_ESTADO_PEDIDO: Record<EstadoPedido, string> = {
  RESERVADO: "bg-sky-100 text-sky-800 border-sky-200",
  EN_PREPARACION: "bg-amber-100 text-amber-800 border-amber-200",
  LISTO: "bg-emerald-100 text-emerald-800 border-emerald-200",
  EN_RUTA: "bg-indigo-100 text-indigo-800 border-indigo-200",
  ENTREGADO: "bg-teal-100 text-teal-800 border-teal-200",
  CANCELADO: "bg-rose-100 text-rose-800 border-rose-200",
  VENCIDO: "bg-slate-200 text-slate-700 border-slate-300",
};

export const ETIQUETA_MODALIDAD: Record<ModalidadPedido, string> = {
  RECOGER: "Recoger en sede",
  DOMICILIO: "Domicilio",
};

export const ETIQUETA_ESTADO_TURNO: Record<EstadoTurno, string> = {
  EN_ESPERA: "En espera",
  LLAMADO: "Llamado",
  ATENDIDO: "Atendido",
  VENCIDO: "Vencido",
  CANCELADO: "Cancelado",
};

export const CLASE_ESTADO_TURNO: Record<EstadoTurno, string> = {
  EN_ESPERA: "bg-sky-100 text-sky-800 border-sky-200",
  LLAMADO: "bg-amber-100 text-amber-900 border-amber-300",
  ATENDIDO: "bg-emerald-100 text-emerald-800 border-emerald-200",
  VENCIDO: "bg-slate-200 text-slate-700 border-slate-300",
  CANCELADO: "bg-rose-100 text-rose-800 border-rose-200",
};

export const ETIQUETA_NIVEL_STOCK: Record<NivelDisponibilidad, string> = {
  DISPONIBLE: "Disponible",
  POCAS_UNIDADES: "Bajo mínimo",
  AGOTADO: "Agotado",
};

export const CLASE_NIVEL_STOCK: Record<NivelDisponibilidad, string> = {
  DISPONIBLE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  POCAS_UNIDADES: "bg-amber-100 text-amber-900 border-amber-200",
  AGOTADO: "bg-rose-100 text-rose-800 border-rose-200",
};

export const ETIQUETA_MOVIMIENTO: Record<TipoMovimiento, string> = {
  ENTRADA: "Entrada",
  AJUSTE_POS: "Ajuste (+)",
  AJUSTE_NEG: "Ajuste (−)",
  RESERVA: "Reserva",
  LIBERACION: "Liberación",
  DISPENSACION: "Dispensación",
  TRASLADO_SALIDA: "Traslado salida",
  TRASLADO_ENTRADA: "Traslado entrada",
};

export const CLASE_MOVIMIENTO: Record<TipoMovimiento, string> = {
  ENTRADA: "bg-emerald-100 text-emerald-800",
  AJUSTE_POS: "bg-teal-100 text-teal-800",
  AJUSTE_NEG: "bg-rose-100 text-rose-800",
  RESERVA: "bg-sky-100 text-sky-800",
  LIBERACION: "bg-indigo-100 text-indigo-800",
  DISPENSACION: "bg-slate-200 text-slate-800",
  TRASLADO_SALIDA: "bg-amber-100 text-amber-800",
  TRASLADO_ENTRADA: "bg-lime-100 text-lime-800",
};

export const ETIQUETA_ESTADO_RUTA: Record<EstadoRuta, string> = {
  PLANEADA: "Planeada",
  EN_CURSO: "En curso",
  COMPLETADA: "Completada",
};

export const CLASE_ESTADO_RUTA: Record<EstadoRuta, string> = {
  PLANEADA: "bg-sky-100 text-sky-800 border-sky-200",
  EN_CURSO: "bg-indigo-100 text-indigo-800 border-indigo-200",
  COMPLETADA: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export const ETIQUETA_ESTADO_PARADA: Record<EstadoRutaParada, string> = {
  PENDIENTE: "Pendiente",
  ENTREGADA: "Entregada",
  FALLIDA: "Fallida",
};

export const CLASE_ESTADO_PARADA: Record<EstadoRutaParada, string> = {
  PENDIENTE: "bg-amber-100 text-amber-900 border-amber-200",
  ENTREGADA: "bg-emerald-100 text-emerald-800 border-emerald-200",
  FALLIDA: "bg-rose-100 text-rose-800 border-rose-200",
};

export function formatearDistanciaKm(km?: number | null): string {
  if (km === undefined || km === null || Number.isNaN(km)) return "0,00 km";
  return `${km.toFixed(2).replace(".", ",")} km`;
}

export function acortarUuid(id?: string | null): string {
  if (!id) return "—";
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}
