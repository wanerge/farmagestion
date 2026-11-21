import type { components, paths } from "./schema";
import { ApiError, parseApiError } from "./problem";

export type Schemas = components["schemas"];
export type AuthResponse = Schemas["AuthResponse"];
export type UsuarioResumen = Schemas["UsuarioResumenResponse"];
export type LoginRequest = Schemas["LoginRequest"];
export type RegistroPacienteRequest = Schemas["RegistroPacienteRequest"];
export type PerfilPaciente = Schemas["PerfilPacienteResponse"];
export type ActualizarPerfilPacienteRequest = Schemas["ActualizarPerfilPacienteRequest"];

export type SedePublica = Schemas["SedePublicaResponse"];
export type MedicamentoPublico = Schemas["MedicamentoPublicoResponse"];
export type PaginaMedicamentos = Schemas["PaginaResponseMedicamentoPublicoResponse"];
export type DisponibilidadMedicamento = Schemas["DisponibilidadMedicamentoResponse"];
export type DisponibilidadSede = Schemas["DisponibilidadSedeResponse"];

export type FormulaResumen = Schemas["FormulaResumenResponse"];
export type FormulaItemResumen = Schemas["FormulaItemResumenResponse"];
export type FormulaDetalle = Schemas["FormulaDetalleResponse"];
export type FormulaItemDetalle = Schemas["FormulaItemDetalleResponse"];
export type DisponibilidadSedeItem = Schemas["DisponibilidadSedeItem"];
export type VincularFormulaRequest = Schemas["VincularFormulaRequest"];

export type FranjasDisponibles = Schemas["FranjasDisponiblesResponse"];
export type FranjaDisponible = Schemas["FranjaDisponibleItem"];

export type CrearPedidoRequest = Schemas["CrearPedidoRequest"];
export type ItemSolicitud = Schemas["ItemSolicitud"];
export type PedidoResumen = Schemas["PedidoResumenResponse"];
export type PaginaPedidos = Schemas["PaginaResponsePedidoResumenResponse"];
export type PedidoDetalle = Schemas["PedidoDetalleResponse"];
export type PedidoItem = Schemas["PedidoItemResponse"];
export type PedidoHistorial = Schemas["PedidoHistorialResponse"];
export type Turno = Schemas["TurnoResponse"];
export type RutaResumenPedido = Schemas["RutaResumenPedidoResponse"];
export type NotaOpcionalRequest = Schemas["NotaOpcionalRequest"];

export type Notificacion = Schemas["NotificacionResponse"];
export type NotificacionesListado = Schemas["NotificacionesListadoResponse"];

export type MedicamentosQuery = NonNullable<
  paths["/api/v1/catalogo/medicamentos"]["get"]["parameters"]["query"]
>;
export type PedidosPacienteQuery = NonNullable<
  paths["/api/v1/pacientes/me/pedidos"]["get"]["parameters"]["query"]
>;
export type NotificacionesPacienteQuery = NonNullable<
  paths["/api/v1/pacientes/me/notificaciones"]["get"]["parameters"]["query"]
>;

export const UMBRAL_DESPERTANDO_MS = 5000;

type SlowListener = (despertando: boolean) => void;
type ErrorListener = (error: ApiError) => void;
type UnauthorizedListener = (error: ApiError) => void;

const slowListeners = new Set<SlowListener>();
const errorListeners = new Set<ErrorListener>();
const unauthorizedListeners = new Set<UnauthorizedListener>();

let slowRequestCount = 0;

function notifySlowListeners() {
  const despertando = slowRequestCount > 0;
  slowListeners.forEach((listener) => listener(despertando));
}

export function suscribirEstadoLento(listener: SlowListener): () => void {
  slowListeners.add(listener);
  listener(slowRequestCount > 0);
  return () => {
    slowListeners.delete(listener);
  };
}

export function suscribirErroresGlobales(listener: ErrorListener): () => void {
  errorListeners.add(listener);
  return () => {
    errorListeners.delete(listener);
  };
}

export function suscribirNoAutenticado(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

export function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  const base = configured && configured.length > 0 ? configured : "http://localhost:8080";
  return base.replace(/\/+$/, "");
}

function buildQueryString(
  params?: Record<string, string | number | boolean | undefined | null>
): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export interface RequestOptions {
  token?: string | null;
  notifyGlobalError?: boolean;
  signal?: AbortSignal;
  slowThresholdMs?: number;
  fetchImpl?: typeof fetch;
}

type ApiPath = keyof paths;

function resolvePath(template: ApiPath, pathParams?: Record<string, string>): string {
  let result: string = template;
  if (pathParams) {
    for (const [key, value] of Object.entries(pathParams)) {
      result = result.replace(`{${key}}`, encodeURIComponent(value));
    }
  }
  return result;
}

async function rawFetch(
  path: string,
  init: RequestInit,
  options: RequestOptions = {},
  acceptHeader = "application/json, application/problem+json"
): Promise<Response> {
  const {
    token,
    notifyGlobalError = true,
    signal,
    slowThresholdMs = UMBRAL_DESPERTANDO_MS,
    fetchImpl = fetch,
  } = options;

  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", acceptHeader);
  }
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let markedSlow = false;
  const timer = setTimeout(() => {
    markedSlow = true;
    slowRequestCount += 1;
    notifySlowListeners();
  }, slowThresholdMs);

  try {
    let response: Response;
    try {
      response = await fetchImpl(`${getApiBaseUrl()}${path}`, {
        ...init,
        headers,
        signal,
        cache: "no-store",
      });
    } catch (networkErr) {
      if (networkErr instanceof DOMException && networkErr.name === "AbortError") {
        throw networkErr;
      }
      const apiErr = new ApiError(
        {
          code: "ERROR_RED",
          title: "Sin conexión con el servicio",
          detail:
            "No fue posible comunicarse con la API de FarmaGestión. Verifica que el servicio esté activo e intenta de nuevo.",
        },
        0
      );
      if (notifyGlobalError) {
        errorListeners.forEach((l) => l(apiErr));
      }
      throw apiErr;
    }

    if (!response.ok) {
      const apiErr = await parseApiError(response);
      if (response.status === 401 && token) {
        unauthorizedListeners.forEach((l) => l(apiErr));
      }
      if (notifyGlobalError) {
        errorListeners.forEach((l) => l(apiErr));
      }
      throw apiErr;
    }

    return response;
  } finally {
    clearTimeout(timer);
    if (markedSlow) {
      slowRequestCount = Math.max(0, slowRequestCount - 1);
      notifySlowListeners();
    }
  }
}

async function apiRequest<TResponse>(
  path: string,
  init: RequestInit,
  options: RequestOptions = {}
): Promise<TResponse> {
  const response = await rawFetch(path, init, options);
  if (response.status === 204) {
    return undefined as TResponse;
  }
  return (await response.json()) as TResponse;
}

function extraerNombreArchivo(contentDisposition: string | null, fallback: string): string {
  if (!contentDisposition) return fallback;
  const match = /filename\*?=(?:UTF-8''|")?([^\s";]+)/i.exec(contentDisposition);
  if (match && match[1]) {
    try {
      return decodeURIComponent(match[1].replace(/"/g, ""));
    } catch {
      return match[1].replace(/"/g, "");
    }
  }
  return fallback;
}

export interface PdfDescargaResult {
  blob: Blob;
  filename: string;
  contentType: string;
}

export const portalApi = {
  // Autenticación pública
  registrarPaciente(
    body: RegistroPacienteRequest,
    options?: RequestOptions
  ): Promise<AuthResponse> {
    return apiRequest<AuthResponse>(
      resolvePath("/api/v1/auth/registro"),
      { method: "POST", body: JSON.stringify(body) },
      { ...options, notifyGlobalError: options?.notifyGlobalError ?? false }
    );
  },

  login(body: LoginRequest, options?: RequestOptions): Promise<AuthResponse> {
    return apiRequest<AuthResponse>(
      resolvePath("/api/v1/auth/login"),
      { method: "POST", body: JSON.stringify(body) },
      { ...options, notifyGlobalError: options?.notifyGlobalError ?? false }
    );
  },

  // Catálogo público (sin autenticación)
  buscarMedicamentos(
    query: MedicamentosQuery = {},
    options?: RequestOptions
  ): Promise<PaginaMedicamentos> {
    const qs = buildQueryString(query);
    return apiRequest<PaginaMedicamentos>(
      `${resolvePath("/api/v1/catalogo/medicamentos")}${qs}`,
      { method: "GET" },
      options
    );
  },

  consultarDisponibilidadMedicamento(
    id: string,
    options?: RequestOptions
  ): Promise<DisponibilidadMedicamento> {
    return apiRequest<DisponibilidadMedicamento>(
      resolvePath("/api/v1/catalogo/medicamentos/{id}/disponibilidad", { id }),
      { method: "GET" },
      options
    );
  },

  listarSedes(options?: RequestOptions): Promise<SedePublica[]> {
    return apiRequest<SedePublica[]>(
      resolvePath("/api/v1/catalogo/sedes"),
      { method: "GET" },
      options
    );
  },

  // Perfil del paciente (RF-PAC-03)
  obtenerPerfil(options?: RequestOptions): Promise<PerfilPaciente> {
    return apiRequest<PerfilPaciente>(
      resolvePath("/api/v1/pacientes/me"),
      { method: "GET" },
      options
    );
  },

  actualizarPerfil(
    body: ActualizarPerfilPacienteRequest,
    options?: RequestOptions
  ): Promise<PerfilPaciente> {
    return apiRequest<PerfilPaciente>(
      resolvePath("/api/v1/pacientes/me"),
      { method: "PUT", body: JSON.stringify(body) },
      options
    );
  },

  // Fórmulas del paciente (RF-PAC-06 a RF-PAC-09)
  vincularFormula(
    body: VincularFormulaRequest,
    options?: RequestOptions
  ): Promise<FormulaDetalle> {
    return apiRequest<FormulaDetalle>(
      resolvePath("/api/v1/pacientes/me/formulas"),
      { method: "POST", body: JSON.stringify(body) },
      options
    );
  },

  listarFormulas(options?: RequestOptions): Promise<FormulaResumen[]> {
    return apiRequest<FormulaResumen[]>(
      resolvePath("/api/v1/pacientes/me/formulas"),
      { method: "GET" },
      options
    );
  },

  obtenerDetalleFormula(
    id: string,
    options?: RequestOptions
  ): Promise<FormulaDetalle> {
    return apiRequest<FormulaDetalle>(
      resolvePath("/api/v1/pacientes/me/formulas/{id}", { id }),
      { method: "GET" },
      options
    );
  },

  async descargarFormulaPdf(
    id: string,
    codigoFormula?: string,
    options?: RequestOptions
  ): Promise<PdfDescargaResult> {
    const response = await rawFetch(
      resolvePath("/api/v1/pacientes/me/formulas/{id}/pdf", { id }),
      { method: "GET" },
      options,
      "application/pdf, application/problem+json"
    );
    const blob = await response.blob();
    const fallback = codigoFormula ? `formula-${codigoFormula}.pdf` : `formula-${id}.pdf`;
    const filename = extraerNombreArchivo(
      response.headers.get("content-disposition"),
      fallback
    );
    const contentType = response.headers.get("content-type") ?? "application/pdf";
    return { blob, filename, contentType };
  },

  // Franjas horarias (RF-PAC-11, RN-PAC-05)
  consultarFranjas(
    sedeId: string,
    fecha?: string,
    options?: RequestOptions
  ): Promise<FranjasDisponibles> {
    const qs = buildQueryString({ fecha });
    return apiRequest<FranjasDisponibles>(
      `${resolvePath("/api/v1/pacientes/me/sedes/{sedeId}/franjas", { sedeId })}${qs}`,
      { method: "GET" },
      options
    );
  },

  // Pedidos del paciente (RF-PAC-10, 11, 13, 14, 15, 16)
  crearPedido(
    body: CrearPedidoRequest,
    options?: RequestOptions
  ): Promise<PedidoDetalle> {
    return apiRequest<PedidoDetalle>(
      resolvePath("/api/v1/pacientes/me/pedidos"),
      { method: "POST", body: JSON.stringify(body) },
      options
    );
  },

  listarPedidos(
    query: PedidosPacienteQuery = {},
    options?: RequestOptions
  ): Promise<PaginaPedidos> {
    const qs = buildQueryString(query);
    return apiRequest<PaginaPedidos>(
      `${resolvePath("/api/v1/pacientes/me/pedidos")}${qs}`,
      { method: "GET" },
      options
    );
  },

  obtenerDetallePedido(
    id: string,
    options?: RequestOptions
  ): Promise<PedidoDetalle> {
    return apiRequest<PedidoDetalle>(
      resolvePath("/api/v1/pacientes/me/pedidos/{id}", { id }),
      { method: "GET" },
      options
    );
  },

  cancelarPedido(
    id: string,
    body?: NotaOpcionalRequest,
    options?: RequestOptions
  ): Promise<PedidoDetalle> {
    return apiRequest<PedidoDetalle>(
      resolvePath("/api/v1/pacientes/me/pedidos/{id}/cancelar", { id }),
      {
        method: "POST",
        body: JSON.stringify(body ?? {}),
      },
      options
    );
  },

  // Notificaciones del paciente (RF-PAC-17, RF-PAC-18)
  listarNotificaciones(
    query: NotificacionesPacienteQuery = {},
    options?: RequestOptions
  ): Promise<NotificacionesListado> {
    const qs = buildQueryString(query);
    return apiRequest<NotificacionesListado>(
      `${resolvePath("/api/v1/pacientes/me/notificaciones")}${qs}`,
      { method: "GET" },
      options
    );
  },

  marcarNotificacionLeida(
    id: string,
    options?: RequestOptions
  ): Promise<Notificacion> {
    return apiRequest<Notificacion>(
      resolvePath("/api/v1/pacientes/me/notificaciones/{id}/leer", { id }),
      { method: "POST" },
      options
    );
  },
};
