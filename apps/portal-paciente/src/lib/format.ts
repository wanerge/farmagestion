export type EstadoPedido =
  | "RESERVADO"
  | "EN_PREPARACION"
  | "LISTO"
  | "EN_RUTA"
  | "ENTREGADO"
  | "CANCELADO"
  | "VENCIDO";

export type ModalidadPedido = "RECOGER" | "DOMICILIO";

export type EstadoTurno =
  | "EN_ESPERA"
  | "LLAMADO"
  | "ATENDIDO"
  | "VENCIDO"
  | "CANCELADO";

export type EstadoFormula =
  | "EMITIDA"
  | "PARCIALMENTE_DISPENSADA"
  | "DISPENSADA"
  | "VENCIDA"
  | "ANULADA";

export type EstadoItemPedido = "COMPLETO" | "PARCIAL" | "AGOTADO";

export type NivelDisponibilidad = "DISPONIBLE" | "POCAS_UNIDADES" | "AGOTADO";

const ZONA_BOGOTA = "America/Bogota";

function formatearFechaBogota(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_BOGOTA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value ?? "2026";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function fechaHoyBogota(ahora = new Date()): string {
  return formatearFechaBogota(ahora);
}

export function fechaMananaBogota(ahora = new Date()): string {
  const manana = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);
  return formatearFechaBogota(manana);
}

export function formatearFecha(isoDate?: string | null): string {
  if (!isoDate) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    const [y, m, d] = isoDate.split("-");
    return `${d}/${m}/${y}`;
  }
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: ZONA_BOGOTA,
    dateStyle: "medium",
  }).format(date);
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
    return { texto: "Reserva vencida", urgente: true, vencido: true };
  }
  if (diffMin < 60) {
    return {
      texto: `Vence en ${diffMin} min`,
      urgente: diffMin <= 30,
      vencido: false,
    };
  }
  const horas = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  return {
    texto: mins > 0 ? `Vence en ${horas} h ${mins} min` : `Vence en ${horas} h`,
    urgente: horas < 2,
    vencido: false,
  };
}

export function puedeCancelarPedidoPaciente(estado?: EstadoPedido | null): boolean {
  return (
    estado === "RESERVADO" ||
    estado === "EN_PREPARACION" ||
    estado === "LISTO"
  );
}

export function esEstadoPedidoActivo(estado?: EstadoPedido | null): boolean {
  return (
    estado === "RESERVADO" ||
    estado === "EN_PREPARACION" ||
    estado === "LISTO" ||
    estado === "EN_RUTA"
  );
}

export const ETIQUETA_NIVEL_DISPONIBILIDAD: Record<NivelDisponibilidad, string> = {
  DISPONIBLE: "Disponible",
  POCAS_UNIDADES: "Pocas unidades",
  AGOTADO: "Agotado",
};

export const CLASE_NIVEL_DISPONIBILIDAD: Record<NivelDisponibilidad, string> = {
  DISPONIBLE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  POCAS_UNIDADES: "bg-amber-100 text-amber-900 border-amber-200",
  AGOTADO: "bg-rose-100 text-rose-800 border-rose-200",
};

export const ETIQUETA_ESTADO_FORMULA: Record<EstadoFormula, string> = {
  EMITIDA: "Emitida",
  PARCIALMENTE_DISPENSADA: "Parcialmente dispensada",
  DISPENSADA: "Dispensada",
  VENCIDA: "Vencida",
  ANULADA: "Anulada",
};

export const CLASE_ESTADO_FORMULA: Record<EstadoFormula, string> = {
  EMITIDA: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PARCIALMENTE_DISPENSADA: "bg-sky-100 text-sky-800 border-sky-200",
  DISPENSADA: "bg-teal-100 text-teal-800 border-teal-200",
  VENCIDA: "bg-slate-200 text-slate-700 border-slate-300",
  ANULADA: "bg-rose-100 text-rose-800 border-rose-200",
};

export const ETIQUETA_ESTADO_PEDIDO: Record<EstadoPedido, string> = {
  RESERVADO: "Reservado",
  EN_PREPARACION: "En preparación",
  LISTO: "Listo para recoger",
  EN_RUTA: "En ruta",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
  VENCIDO: "Vencido",
};

export const CLASE_ESTADO_PEDIDO: Record<EstadoPedido, string> = {
  RESERVADO: "bg-sky-100 text-sky-800 border-sky-200",
  EN_PREPARACION: "bg-amber-100 text-amber-900 border-amber-200",
  LISTO: "bg-emerald-100 text-emerald-800 border-emerald-200",
  EN_RUTA: "bg-indigo-100 text-indigo-800 border-indigo-200",
  ENTREGADO: "bg-teal-100 text-teal-800 border-teal-200",
  CANCELADO: "bg-rose-100 text-rose-800 border-rose-200",
  VENCIDO: "bg-slate-200 text-slate-700 border-slate-300",
};

export const ETIQUETA_ESTADO_TURNO: Record<EstadoTurno, string> = {
  EN_ESPERA: "En espera",
  LLAMADO: "Llamado en ventanilla",
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

export const ETIQUETA_ESTADO_ITEM: Record<EstadoItemPedido, string> = {
  COMPLETO: "Completo",
  PARCIAL: "Parcial",
  AGOTADO: "Agotado",
};

export const CLASE_ESTADO_ITEM: Record<EstadoItemPedido, string> = {
  COMPLETO: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PARCIAL: "bg-amber-100 text-amber-900 border-amber-200",
  AGOTADO: "bg-rose-100 text-rose-800 border-rose-200",
};

export const ETIQUETA_MODALIDAD: Record<ModalidadPedido, string> = {
  RECOGER: "Recoger en sede",
  DOMICILIO: "Domicilio",
};

export const TIPOS_DOCUMENTO = [
  { codigo: "CC", etiqueta: "Cédula de ciudadanía (CC)" },
  { codigo: "TI", etiqueta: "Tarjeta de identidad (TI)" },
  { codigo: "CE", etiqueta: "Cédula de extranjería (CE)" },
  { codigo: "PA", etiqueta: "Pasaporte (PA)" },
  { codigo: "PPT", etiqueta: "Permiso por Protección Temporal (PPT)" },
] as const;
