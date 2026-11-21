export interface StockInsuficienteItem {
  medicamentoId: string;
  solicitada: number;
  disponible: number;
  reservada: number;
  estadoItem: "COMPLETO" | "PARCIAL" | "AGOTADO";
}

export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  code?: string;
  errores?: Record<string, string>;
  items?: StockInsuficienteItem[];
  [key: string]: unknown;
}

const MENSAJES_POR_CODIGO: Record<string, string> = {
  CREDENCIALES_INVALIDAS: "Correo o contraseña incorrectos.",
  USUARIO_INACTIVO: "Tu cuenta se encuentra inactiva.",
  NO_AUTENTICADO: "Tu sesión ha expirado o no es válida. Inicia sesión nuevamente.",
  TOKEN_INVALIDO: "Tu sesión ha expirado. Inicia sesión nuevamente.",
  ACCESO_DENEGADO: "No tienes permisos para realizar esta operación.",
  EMAIL_YA_REGISTRADO: "Ya existe una cuenta registrada con ese correo electrónico.",
  CORREO_YA_REGISTRADO: "Ya existe una cuenta registrada con ese correo electrónico.",
  DOCUMENTO_YA_REGISTRADO: "Ya existe un paciente registrado con ese tipo y número de documento.",
  PASSWORD_ACTUAL_REQUERIDA: "Debes ingresar tu contraseña actual para cambiarla.",
  PASSWORD_ACTUAL_INVALIDA: "La contraseña actual ingresada no coincide.",
  FORMULA_NO_ENCONTRADA: "No encontramos una fórmula con esos datos.",
  FORMULA_YA_VINCULADA: "Esta fórmula ya se encuentra vinculada a tu cuenta.",
  FORMULA_NO_VIGENTE: "La fórmula no está vigente o ya fue dispensada por completo.",
  STOCK_INSUFICIENTE: "No hay stock suficiente en la sede para completar todos los medicamentos.",
  FRANJA_SIN_CUPO: "La franja horaria seleccionada se llenó. Elige otra franja disponible.",
  FRANJA_INVALIDA: "La franja horaria elegida no es válida o no cumple la anticipación mínima de 60 minutos.",
  CANTIDAD_EXCEDE_PENDIENTE: "La cantidad solicitada supera el saldo pendiente autorizado en la fórmula.",
  LIMITE_PEDIDOS_ACTIVOS: "Ya tienes el máximo de 3 pedidos activos al mismo tiempo.",
  PEDIDO_NO_ENCONTRADO: "No se encontró el pedido solicitado.",
  SEDE_NO_ENCONTRADA: "No se encontró la sede solicitada.",
  MEDICAMENTO_NO_ENCONTRADO: "No se encontró el medicamento solicitado.",
  TRANSICION_INVALIDA: "No es posible realizar esta acción en el estado actual del pedido.",
  SIMULADOR_NO_DISPONIBLE:
    "No fue posible validar la fórmula con el servicio de la EPS en este momento. Intenta de nuevo en unos segundos.",
  VALIDACION_ERROR: "Revisa los datos ingresados en el formulario.",
  ERROR_RED: "No fue posible conectar con el servidor de FarmaGestión.",
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly title: string;
  readonly detail: string;
  readonly problem: ProblemDetail;

  constructor(problem: ProblemDetail, status: number) {
    const code =
      typeof problem.code === "string" && problem.code ? problem.code : `HTTP_${status}`;
    const detail =
      (typeof problem.detail === "string" && problem.detail.trim()) ||
      MENSAJES_POR_CODIGO[code] ||
      (typeof problem.title === "string" && problem.title.trim()) ||
      "Ocurrió un error al procesar la solicitud.";
    const title =
      (typeof problem.title === "string" && problem.title.trim()) ||
      "Error en la solicitud";

    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.title = title;
    this.detail = detail;
    this.problem = { ...problem, status, code, title, detail };
  }

  get mensajeUsuario(): string {
    return this.detail || MENSAJES_POR_CODIGO[this.code] || this.title;
  }

  get erroresCampos(): Record<string, string> | undefined {
    if (this.problem.errores && typeof this.problem.errores === "object") {
      return this.problem.errores;
    }
    return undefined;
  }

  get stockInsuficienteItems(): StockInsuficienteItem[] | undefined {
    if (!Array.isArray(this.problem.items)) {
      return undefined;
    }
    return this.problem.items.filter(
      (item): item is StockInsuficienteItem =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof item.medicamentoId === "string" &&
        typeof item.solicitada === "number" &&
        typeof item.disponible === "number"
    );
  }
}

export async function parseApiError(response: Response): Promise<ApiError> {
  const contentType = response.headers.get("content-type") ?? "";
  let parsed: ProblemDetail = {};

  if (contentType.includes("json")) {
    try {
      const json = (await response.json()) as unknown;
      if (json && typeof json === "object") {
        parsed = json as ProblemDetail;
      }
    } catch {
      parsed = {};
    }
  } else {
    try {
      const text = await response.text();
      if (text.trim()) {
        parsed = { detail: text.trim().slice(0, 300) };
      }
    } catch {
      parsed = {};
    }
  }

  return new ApiError(parsed, response.status);
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
