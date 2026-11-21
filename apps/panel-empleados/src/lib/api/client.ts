import type { components, paths } from "./schema";
import { ApiError, parseApiError } from "./problem";

export type Schemas = components["schemas"];
export type AuthResponse = Schemas["AuthResponse"];
export type UsuarioResumen = Schemas["UsuarioResumenResponse"];
export type LoginRequest = Schemas["LoginRequest"];
export type SedePublica = Schemas["SedePublicaResponse"];
export type InventarioItem = Schemas["InventarioItemResponse"];
export type PaginaInventario = Schemas["PaginaResponseInventarioItemResponse"];
export type EntradaStockRequest = Schemas["EntradaStockRequest"];
export type AjusteStockRequest = Schemas["AjusteStockRequest"];
export type ActualizarStockMinimoRequest = Schemas["ActualizarStockMinimoRequest"];
export type MovimientoKardex = Schemas["MovimientoKardexResponse"];
export type PaginaKardex = Schemas["PaginaResponseMovimientoKardexResponse"];
export type PedidoResumen = Schemas["PedidoResumenResponse"];
export type PaginaPedidos = Schemas["PaginaResponsePedidoResumenResponse"];
export type PedidoDetalle = Schemas["PedidoDetalleResponse"];
export type PedidoItem = Schemas["PedidoItemResponse"];
export type PedidoHistorial = Schemas["PedidoHistorialResponse"];
export type Turno = Schemas["TurnoResponse"];
export type PantallaSala = Schemas["PantallaSalaResponse"];
export type TurnoSalaItem = Schemas["TurnoSalaItem"];
export type Notificacion = Schemas["NotificacionResponse"];
export type NotificacionesListado = Schemas["NotificacionesListadoResponse"];
export type NotaOpcionalRequest = Schemas["NotaOpcionalRequest"];
export type EntregarPedidoRequest = Schemas["EntregarPedidoRequest"];
export type CancelarPedidoGestionRequest = Schemas["CancelarPedidoGestionRequest"];
export type DomiciliosPendientes = Schemas["DomiciliosPendientesResponse"];
export type PedidoPendienteDomicilio = Schemas["PedidoPendienteDomicilioResponse"];
export type DomiciliarioResumen = Schemas["DomiciliarioResumenResponse"];
export type RutaDetalle = Schemas["RutaDetalleResponse"];
export type RutaParada = Schemas["RutaParadaResponse"];
export type RutaResumenPedido = Schemas["RutaResumenPedidoResponse"];
export type CrearRutaRequest = Schemas["CrearRutaRequest"];
export type ReordenarRutaRequest = Schemas["ReordenarRutaRequest"];
export type EntregarParadaRequest = Schemas["EntregarParadaRequest"];
export type ParadaFallidaRequest = Schemas["ParadaFallidaRequest"];
export type ReportePedidos = Schemas["ReportePedidosResponse"];
export type ReporteTiempos = Schemas["ReporteTiemposResponse"];
export type ReporteTurnos = Schemas["ReporteTurnosResponse"];
export type ReporteFaltantes = Schemas["ReporteFaltantesResponse"];
export type SedeAdmin = Schemas["SedeAdminResponse"];
export type CrearSedeRequest = Schemas["CrearSedeRequest"];
export type ActualizarSedeRequest = Schemas["ActualizarSedeRequest"];
export type EmpleadoAdmin = Schemas["EmpleadoAdminResponse"];
export type CrearEmpleadoRequest = Schemas["CrearEmpleadoRequest"];
export type ActualizarEmpleadoRequest = Schemas["ActualizarEmpleadoRequest"];
export type MedicamentoAdmin = Schemas["MedicamentoAdminResponse"];
export type PaginaMedicamentosAdmin = Schemas["PaginaResponseMedicamentoAdminResponse"];
export type CrearMedicamentoRequest = Schemas["CrearMedicamentoRequest"];
export type ActualizarMedicamentoRequest = Schemas["ActualizarMedicamentoRequest"];
export type Parametro = Schemas["ParametroResponse"];
export type ActualizarParametrosRequest = Schemas["ActualizarParametrosRequest"];
export type EventoIntegracion = Schemas["EventoIntegracionResponse"];
export type PaginaEventosIntegracion = Schemas["PaginaResponseEventoIntegracionResponse"];
export type EstadoEventoIntegracion = NonNullable<EventoIntegracion["estado"]>;

export type EstadoPedido = NonNullable<PedidoResumen["estado"]>;
export type ModalidadPedido = NonNullable<PedidoResumen["modalidad"]>;
export type EstadoTurno = NonNullable<Turno["estado"]>;
export type EstadoRuta = NonNullable<RutaDetalle["estado"]>;
export type EstadoRutaParada = NonNullable<RutaParada["estado"]>;
export type TipoMovimiento = NonNullable<MovimientoKardex["tipo"]>;
export type NivelDisponibilidad = NonNullable<InventarioItem["nivel"]>;
export type RolUsuario = NonNullable<UsuarioResumen["rol"]>;
export type CargoEmpleado = NonNullable<UsuarioResumen["cargo"]>;

export type InventarioQuery = NonNullable<
  paths["/api/v1/gestion/inventario"]["get"]["parameters"]["query"]
>;
export type KardexQuery = NonNullable<
  paths["/api/v1/gestion/inventario/{medicamentoId}/kardex"]["get"]["parameters"]["query"]
>;
export type PedidosQuery = NonNullable<
  paths["/api/v1/gestion/pedidos"]["get"]["parameters"]["query"]
>;
export type TurnosQuery = NonNullable<
  paths["/api/v1/gestion/turnos"]["get"]["parameters"]["query"]
>;
export type NotificacionesQuery = NonNullable<
  paths["/api/v1/gestion/notificaciones"]["get"]["parameters"]["query"]
>;
export type DomiciliosPendientesQuery = NonNullable<
  paths["/api/v1/gestion/domicilios/pendientes"]["get"]["parameters"]["query"]
>;
export type RutasQuery = NonNullable<
  paths["/api/v1/gestion/rutas"]["get"]["parameters"]["query"]
>;
export type MisRutasQuery = NonNullable<
  paths["/api/v1/gestion/rutas/mias"]["get"]["parameters"]["query"]
>;
export type ReporteQuery = NonNullable<
  paths["/api/v1/gestion/reportes/pedidos"]["get"]["parameters"]["query"]
>;
export type MedicamentosAdminQuery = NonNullable<
  paths["/api/v1/gestion/admin/medicamentos"]["get"]["parameters"]["query"]
>;
export type EventosIntegracionQuery = NonNullable<
  paths["/api/v1/gestion/admin/integracion/eventos"]["get"]["parameters"]["query"]
>;

export interface ResumenTablero {
  pedidosPorEstado: Record<EstadoPedido, number>;
  turnosHoy: {
    enEspera: number;
    llamados: number;
    atendidos: number;
    vencidos: number;
    cancelados: number;
    total: number;
  };
  medicamentosBajoMinimo: {
    total: number;
    agotados: number;
    muestra: InventarioItem[];
  };
  domiciliosHoy: number;
}

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

function buildQueryString(params?: Record<string, string | number | boolean | undefined | null>): string {
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

async function apiRequest<TResponse>(
  path: string,
  init: RequestInit,
  options: RequestOptions = {}
): Promise<TResponse> {
  const {
    token,
    notifyGlobalError = true,
    signal,
    slowThresholdMs = UMBRAL_DESPERTANDO_MS,
    fetchImpl = fetch,
  } = options;

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json, application/problem+json");
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

    if (response.status === 204) {
      return undefined as TResponse;
    }

    return (await response.json()) as TResponse;
  } finally {
    clearTimeout(timer);
    if (markedSlow) {
      slowRequestCount = Math.max(0, slowRequestCount - 1);
      notifySlowListeners();
    }
  }
}

function resolvePath(template: ApiPath, pathParams?: Record<string, string>): string {
  let result: string = template;
  if (pathParams) {
    for (const [key, value] of Object.entries(pathParams)) {
      result = result.replace(`{${key}}`, encodeURIComponent(value));
    }
  }
  return result;
}

export const farmaApi = {
  // Autenticación
  login(body: LoginRequest, options?: RequestOptions): Promise<AuthResponse> {
    return apiRequest<AuthResponse>(
      resolvePath("/api/v1/auth/login"),
      { method: "POST", body: JSON.stringify(body) },
      { ...options, notifyGlobalError: options?.notifyGlobalError ?? false }
    );
  },

  // Catálogo público (sedes para selector de ADMIN y acceso a pantallas de sala)
  listarSedes(options?: RequestOptions): Promise<SedePublica[]> {
    return apiRequest<SedePublica[]>(
      resolvePath("/api/v1/catalogo/sedes"),
      { method: "GET" },
      options
    );
  },

  // Inventario
  listarInventario(
    query: InventarioQuery = {},
    options?: RequestOptions
  ): Promise<PaginaInventario> {
    const qs = buildQueryString(query);
    return apiRequest<PaginaInventario>(
      `${resolvePath("/api/v1/gestion/inventario")}${qs}`,
      { method: "GET" },
      options
    );
  },

  registrarEntrada(
    medicamentoId: string,
    body: EntradaStockRequest,
    sedeId?: string,
    options?: RequestOptions
  ): Promise<InventarioItem> {
    const qs = buildQueryString({ sedeId });
    return apiRequest<InventarioItem>(
      `${resolvePath("/api/v1/gestion/inventario/{medicamentoId}/entradas", { medicamentoId })}${qs}`,
      { method: "POST", body: JSON.stringify(body) },
      options
    );
  },

  registrarAjuste(
    medicamentoId: string,
    body: AjusteStockRequest,
    sedeId?: string,
    options?: RequestOptions
  ): Promise<InventarioItem> {
    const qs = buildQueryString({ sedeId });
    return apiRequest<InventarioItem>(
      `${resolvePath("/api/v1/gestion/inventario/{medicamentoId}/ajustes", { medicamentoId })}${qs}`,
      { method: "POST", body: JSON.stringify(body) },
      options
    );
  },

  actualizarStockMinimo(
    medicamentoId: string,
    body: ActualizarStockMinimoRequest,
    sedeId?: string,
    options?: RequestOptions
  ): Promise<InventarioItem> {
    const qs = buildQueryString({ sedeId });
    return apiRequest<InventarioItem>(
      `${resolvePath("/api/v1/gestion/inventario/{medicamentoId}", { medicamentoId })}${qs}`,
      { method: "PATCH", body: JSON.stringify(body) },
      options
    );
  },

  consultarKardex(
    medicamentoId: string,
    query: KardexQuery = {},
    options?: RequestOptions
  ): Promise<PaginaKardex> {
    const qs = buildQueryString(query);
    return apiRequest<PaginaKardex>(
      `${resolvePath("/api/v1/gestion/inventario/{medicamentoId}/kardex", { medicamentoId })}${qs}`,
      { method: "GET" },
      options
    );
  },

  // Pedidos
  listarPedidos(
    query: PedidosQuery = {},
    options?: RequestOptions
  ): Promise<PaginaPedidos> {
    const qs = buildQueryString(query);
    return apiRequest<PaginaPedidos>(
      `${resolvePath("/api/v1/gestion/pedidos")}${qs}`,
      { method: "GET" },
      options
    );
  },

  obtenerPedido(id: string, options?: RequestOptions): Promise<PedidoDetalle> {
    return apiRequest<PedidoDetalle>(
      resolvePath("/api/v1/gestion/pedidos/{id}", { id }),
      { method: "GET" },
      options
    );
  },

  tomarPedido(
    id: string,
    body?: NotaOpcionalRequest,
    options?: RequestOptions
  ): Promise<PedidoDetalle> {
    return apiRequest<PedidoDetalle>(
      resolvePath("/api/v1/gestion/pedidos/{id}/tomar", { id }),
      {
        method: "POST",
        body: body ? JSON.stringify(body) : JSON.stringify({}),
      },
      options
    );
  },

  marcarPedidoListo(
    id: string,
    body?: NotaOpcionalRequest,
    options?: RequestOptions
  ): Promise<PedidoDetalle> {
    return apiRequest<PedidoDetalle>(
      resolvePath("/api/v1/gestion/pedidos/{id}/listo", { id }),
      {
        method: "POST",
        body: body ? JSON.stringify(body) : JSON.stringify({}),
      },
      options
    );
  },

  entregarPedido(
    id: string,
    body: EntregarPedidoRequest,
    options?: RequestOptions
  ): Promise<PedidoDetalle> {
    return apiRequest<PedidoDetalle>(
      resolvePath("/api/v1/gestion/pedidos/{id}/entregar", { id }),
      { method: "POST", body: JSON.stringify(body) },
      options
    );
  },

  cancelarPedido(
    id: string,
    body: CancelarPedidoGestionRequest,
    options?: RequestOptions
  ): Promise<PedidoDetalle> {
    return apiRequest<PedidoDetalle>(
      resolvePath("/api/v1/gestion/pedidos/{id}/cancelar", { id }),
      { method: "POST", body: JSON.stringify(body) },
      options
    );
  },

  // Turnos y sala pública
  listarTurnos(query: TurnosQuery = {}, options?: RequestOptions): Promise<Turno[]> {
    const qs = buildQueryString(query);
    return apiRequest<Turno[]>(
      `${resolvePath("/api/v1/gestion/turnos")}${qs}`,
      { method: "GET" },
      options
    );
  },

  llamarSiguienteTurno(
    query: TurnosQuery = {},
    options?: RequestOptions
  ): Promise<Turno> {
    const qs = buildQueryString(query);
    return apiRequest<Turno>(
      `${resolvePath("/api/v1/gestion/turnos/llamar-siguiente")}${qs}`,
      { method: "POST" },
      options
    );
  },

  vencerTurno(id: string, options?: RequestOptions): Promise<Turno> {
    return apiRequest<Turno>(
      resolvePath("/api/v1/gestion/turnos/{id}/vencer", { id }),
      { method: "POST" },
      options
    );
  },

  consultarPantallaSala(
    sedeCodigo: string,
    fecha?: string,
    options?: RequestOptions
  ): Promise<PantallaSala> {
    const qs = buildQueryString({ fecha });
    return apiRequest<PantallaSala>(
      `${resolvePath("/api/v1/gestion/public/sala/{sedeCodigo}", { sedeCodigo })}${qs}`,
      { method: "GET" },
      options
    );
  },

  // Notificaciones
  listarNotificaciones(
    query: NotificacionesQuery = {},
    options?: RequestOptions
  ): Promise<NotificacionesListado> {
    const qs = buildQueryString(query);
    return apiRequest<NotificacionesListado>(
      `${resolvePath("/api/v1/gestion/notificaciones")}${qs}`,
      { method: "GET" },
      options
    );
  },

  marcarNotificacionLeida(
    id: string,
    options?: RequestOptions
  ): Promise<Notificacion> {
    return apiRequest<Notificacion>(
      resolvePath("/api/v1/gestion/notificaciones/{id}/leer", { id }),
      { method: "POST" },
      options
    );
  },

  // Domicilios y rutas (RF-EMP-19 a RF-EMP-24)
  listarDomiciliosPendientes(
    query: DomiciliosPendientesQuery = {},
    options?: RequestOptions
  ): Promise<DomiciliosPendientes> {
    const qs = buildQueryString(query);
    return apiRequest<DomiciliosPendientes>(
      `${resolvePath("/api/v1/gestion/domicilios/pendientes")}${qs}`,
      { method: "GET" },
      options
    );
  },

  listarRutas(
    query: RutasQuery = {},
    options?: RequestOptions
  ): Promise<RutaDetalle[]> {
    const qs = buildQueryString(query);
    return apiRequest<RutaDetalle[]>(
      `${resolvePath("/api/v1/gestion/rutas")}${qs}`,
      { method: "GET" },
      options
    );
  },

  listarMisRutas(
    query: MisRutasQuery = {},
    options?: RequestOptions
  ): Promise<RutaDetalle[]> {
    const qs = buildQueryString(query);
    return apiRequest<RutaDetalle[]>(
      `${resolvePath("/api/v1/gestion/rutas/mias")}${qs}`,
      { method: "GET" },
      options
    );
  },

  obtenerRuta(id: string, options?: RequestOptions): Promise<RutaDetalle> {
    return apiRequest<RutaDetalle>(
      resolvePath("/api/v1/gestion/rutas/{id}", { id }),
      { method: "GET" },
      options
    );
  },

  crearRuta(
    body: CrearRutaRequest,
    params: { sedeId?: string } = {},
    options?: RequestOptions
  ): Promise<RutaDetalle> {
    const qs = buildQueryString(params);
    return apiRequest<RutaDetalle>(
      `${resolvePath("/api/v1/gestion/rutas")}${qs}`,
      { method: "POST", body: JSON.stringify(body) },
      options
    );
  },

  reordenarRuta(
    id: string,
    body: ReordenarRutaRequest,
    options?: RequestOptions
  ): Promise<RutaDetalle> {
    return apiRequest<RutaDetalle>(
      resolvePath("/api/v1/gestion/rutas/{id}/orden", { id }),
      { method: "PUT", body: JSON.stringify(body) },
      options
    );
  },

  iniciarRuta(id: string, options?: RequestOptions): Promise<RutaDetalle> {
    return apiRequest<RutaDetalle>(
      resolvePath("/api/v1/gestion/rutas/{id}/iniciar", { id }),
      { method: "POST" },
      options
    );
  },

  marcarParadaEntregada(
    rutaId: string,
    paradaId: string,
    body: EntregarParadaRequest = {},
    options?: RequestOptions
  ): Promise<RutaDetalle> {
    return apiRequest<RutaDetalle>(
      resolvePath("/api/v1/gestion/rutas/{id}/paradas/{paradaId}/entregar", {
        id: rutaId,
        paradaId,
      }),
      { method: "POST", body: JSON.stringify(body) },
      options
    );
  },

  marcarParadaFallida(
    rutaId: string,
    paradaId: string,
    body: ParadaFallidaRequest,
    options?: RequestOptions
  ): Promise<RutaDetalle> {
    return apiRequest<RutaDetalle>(
      resolvePath("/api/v1/gestion/rutas/{id}/paradas/{paradaId}/fallida", {
        id: rutaId,
        paradaId,
      }),
      { method: "POST", body: JSON.stringify(body) },
      options
    );
  },

  // Reportes (RF-EMP-28, RF-EMP-29, CA-EMP-14)
  obtenerReportePedidos(
    query: ReporteQuery = {},
    options?: RequestOptions
  ): Promise<ReportePedidos> {
    const qs = buildQueryString(query);
    return apiRequest<ReportePedidos>(
      `${resolvePath("/api/v1/gestion/reportes/pedidos")}${qs}`,
      { method: "GET" },
      options
    );
  },

  obtenerReporteTiempos(
    query: ReporteQuery = {},
    options?: RequestOptions
  ): Promise<ReporteTiempos> {
    const qs = buildQueryString(query);
    return apiRequest<ReporteTiempos>(
      `${resolvePath("/api/v1/gestion/reportes/tiempos")}${qs}`,
      { method: "GET" },
      options
    );
  },

  obtenerReporteTurnos(
    query: ReporteQuery = {},
    options?: RequestOptions
  ): Promise<ReporteTurnos> {
    const qs = buildQueryString(query);
    return apiRequest<ReporteTurnos>(
      `${resolvePath("/api/v1/gestion/reportes/turnos")}${qs}`,
      { method: "GET" },
      options
    );
  },

  obtenerReporteFaltantes(
    query: ReporteQuery = {},
    options?: RequestOptions
  ): Promise<ReporteFaltantes> {
    const qs = buildQueryString(query);
    return apiRequest<ReporteFaltantes>(
      `${resolvePath("/api/v1/gestion/reportes/faltantes")}${qs}`,
      { method: "GET" },
      options
    );
  },

  // Administración (solo ADMIN, RF-EMP-30 a RF-EMP-34)
  listarSedesAdmin(options?: RequestOptions): Promise<SedeAdmin[]> {
    return apiRequest<SedeAdmin[]>(
      resolvePath("/api/v1/gestion/admin/sedes"),
      { method: "GET" },
      options
    );
  },

  crearSedeAdmin(body: CrearSedeRequest, options?: RequestOptions): Promise<SedeAdmin> {
    return apiRequest<SedeAdmin>(
      resolvePath("/api/v1/gestion/admin/sedes"),
      { method: "POST", body: JSON.stringify(body) },
      options
    );
  },

  actualizarSedeAdmin(
    id: string,
    body: ActualizarSedeRequest,
    options?: RequestOptions
  ): Promise<SedeAdmin> {
    return apiRequest<SedeAdmin>(
      resolvePath("/api/v1/gestion/admin/sedes/{id}", { id }),
      { method: "PUT", body: JSON.stringify(body) },
      options
    );
  },

  listarEmpleadosAdmin(options?: RequestOptions): Promise<EmpleadoAdmin[]> {
    return apiRequest<EmpleadoAdmin[]>(
      resolvePath("/api/v1/gestion/admin/empleados"),
      { method: "GET" },
      options
    );
  },

  crearEmpleadoAdmin(
    body: CrearEmpleadoRequest,
    options?: RequestOptions
  ): Promise<EmpleadoAdmin> {
    return apiRequest<EmpleadoAdmin>(
      resolvePath("/api/v1/gestion/admin/empleados"),
      { method: "POST", body: JSON.stringify(body) },
      options
    );
  },

  actualizarEmpleadoAdmin(
    id: string,
    body: ActualizarEmpleadoRequest,
    options?: RequestOptions
  ): Promise<EmpleadoAdmin> {
    return apiRequest<EmpleadoAdmin>(
      resolvePath("/api/v1/gestion/admin/empleados/{id}", { id }),
      { method: "PUT", body: JSON.stringify(body) },
      options
    );
  },

  listarMedicamentosAdmin(
    query: MedicamentosAdminQuery = {},
    options?: RequestOptions
  ): Promise<PaginaMedicamentosAdmin> {
    const qs = buildQueryString(query);
    return apiRequest<PaginaMedicamentosAdmin>(
      `${resolvePath("/api/v1/gestion/admin/medicamentos")}${qs}`,
      { method: "GET" },
      options
    );
  },

  crearMedicamentoAdmin(
    body: CrearMedicamentoRequest,
    options?: RequestOptions
  ): Promise<MedicamentoAdmin> {
    return apiRequest<MedicamentoAdmin>(
      resolvePath("/api/v1/gestion/admin/medicamentos"),
      { method: "POST", body: JSON.stringify(body) },
      options
    );
  },

  actualizarMedicamentoAdmin(
    id: string,
    body: ActualizarMedicamentoRequest,
    options?: RequestOptions
  ): Promise<MedicamentoAdmin> {
    return apiRequest<MedicamentoAdmin>(
      resolvePath("/api/v1/gestion/admin/medicamentos/{id}", { id }),
      { method: "PUT", body: JSON.stringify(body) },
      options
    );
  },

  listarParametrosAdmin(options?: RequestOptions): Promise<Parametro[]> {
    return apiRequest<Parametro[]>(
      resolvePath("/api/v1/gestion/admin/parametros"),
      { method: "GET" },
      options
    );
  },

  actualizarParametrosAdmin(
    body: ActualizarParametrosRequest,
    options?: RequestOptions
  ): Promise<Parametro[]> {
    return apiRequest<Parametro[]>(
      resolvePath("/api/v1/gestion/admin/parametros"),
      { method: "PUT", body: JSON.stringify(body) },
      options
    );
  },

  listarEventosIntegracionAdmin(
    query: EventosIntegracionQuery = {},
    options?: RequestOptions
  ): Promise<PaginaEventosIntegracion> {
    const qs = buildQueryString(query);
    return apiRequest<PaginaEventosIntegracion>(
      `${resolvePath("/api/v1/gestion/admin/integracion/eventos")}${qs}`,
      { method: "GET" },
      options
    );
  },

  reintentarEventoIntegracionAdmin(
    id: string,
    options?: RequestOptions
  ): Promise<EventoIntegracion> {
    return apiRequest<EventoIntegracion>(
      resolvePath("/api/v1/gestion/admin/integracion/eventos/{id}/reintentar", { id }),
      { method: "POST" },
      options
    );
  },

  /**
   * Compone el resumen operativo del tablero (RF-EMP-02) usando los endpoints
   * publicados en contracts/farmagestion-api.openapi.json.
   */
  async obtenerResumenTablero(
    params: { sedeId?: string; fechaHoy: string; consultarTurnos: boolean },
    options?: RequestOptions
  ): Promise<ResumenTablero> {
    const estados: EstadoPedido[] = [
      "RESERVADO",
      "EN_PREPARACION",
      "LISTO",
      "EN_RUTA",
      "ENTREGADO",
      "CANCELADO",
      "VENCIDO",
    ];

    const [
      conteosEstados,
      domiciliosRes,
      bajoMinimoRes,
      agotadosRes,
      turnosList,
    ] = await Promise.all([
      Promise.all(
        estados.map(async (estado) => {
          const res = await this.listarPedidos(
            { sedeId: params.sedeId, estado, page: 0, size: 1 },
            options
          );
          return [estado, res.totalElements ?? 0] as const;
        })
      ),
      this.listarPedidos(
        {
          sedeId: params.sedeId,
          modalidad: "DOMICILIO",
          fecha: params.fechaHoy,
          page: 0,
          size: 1,
        },
        options
      ),
      this.listarInventario(
        { sedeId: params.sedeId, bajoMinimo: true, page: 0, size: 8 },
        options
      ),
      this.listarInventario(
        { sedeId: params.sedeId, agotado: true, page: 0, size: 1 },
        options
      ),
      params.consultarTurnos
        ? this.listarTurnos(
            { sedeId: params.sedeId, fecha: params.fechaHoy },
            options
          )
        : Promise.resolve([] as Turno[]),
    ]);

    const pedidosPorEstado = Object.fromEntries(conteosEstados) as Record<
      EstadoPedido,
      number
    >;

    const turnosHoy = {
      enEspera: 0,
      llamados: 0,
      atendidos: 0,
      vencidos: 0,
      cancelados: 0,
      total: turnosList.length,
    };

    for (const turno of turnosList) {
      if (turno.estado === "EN_ESPERA") turnosHoy.enEspera += 1;
      else if (turno.estado === "LLAMADO") turnosHoy.llamados += 1;
      else if (turno.estado === "ATENDIDO") turnosHoy.atendidos += 1;
      else if (turno.estado === "VENCIDO") turnosHoy.vencidos += 1;
      else if (turno.estado === "CANCELADO") turnosHoy.cancelados += 1;
    }

    return {
      pedidosPorEstado,
      turnosHoy,
      medicamentosBajoMinimo: {
        total: bajoMinimoRes.totalElements ?? 0,
        agotados: agotadosRes.totalElements ?? 0,
        muestra: bajoMinimoRes.content ?? [],
      },
      domiciliosHoy: domiciliosRes.totalElements ?? 0,
    };
  },
};
