export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  code?: string;
  errores?: Record<string, string>;
  [key: string]: unknown;
}

const MENSAJES_POR_CODIGO: Record<string, string> = {
  CREDENCIALES_INVALIDAS: "Correo o contraseña incorrectos.",
  USUARIO_INACTIVO: "Tu cuenta se encuentra inactiva. Contacta al administrador.",
  NO_AUTENTICADO: "Tu sesión ha expirado o no es válida. Inicia sesión nuevamente.",
  ACCESO_DENEGADO: "No tienes permisos para realizar esta operación.",
  SEDE_NO_AUTORIZADA: "No tienes permiso para acceder a datos de otra sede.",
  SEDE_REQUERIDA: "Debes seleccionar una sede para realizar esta operación.",
  TRANSICION_INVALIDA: "La transición de estado no es válida para este registro.",
  DOCUMENTO_NO_COINCIDE:
    "El documento ingresado no coincide con el titular del pedido.",
  PEDIDO_ASIGNADO_A_OTRO:
    "Este pedido está siendo preparado por otro empleado. Solo quien lo tomó o un administrador puede modificarlo.",
  AJUSTE_INVALIDO_RESERVA:
    "El ajuste dejaría el inventario físico por debajo de las unidades reservadas sin pedidos reducibles.",
  CANTIDAD_INVALIDA: "La cantidad ingresada no es válida.",
  SIN_TURNOS_EN_ESPERA: "No hay turnos en espera para llamar en esta sede.",
  SEDE_NO_ENCONTRADA: "No se encontró la sede solicitada.",
  PEDIDO_NO_ENCONTRADO: "No se encontró el pedido solicitado.",
  TURNO_NO_ENCONTRADO: "No se encontró el turno solicitado.",
  INVENTARIO_NO_ENCONTRADO:
    "No existe registro de inventario para este medicamento en la sede.",
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
    const code = typeof problem.code === "string" && problem.code ? problem.code : `HTTP_${status}`;
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
