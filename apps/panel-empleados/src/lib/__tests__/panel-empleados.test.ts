import { describe, expect, it, vi } from "vitest";
import {
  farmaApi,
  suscribirErroresGlobales,
  suscribirEstadoLento,
  type PedidoDetalle,
  type UsuarioResumen,
} from "../api/client";
import { ApiError, isApiError } from "../api/problem";
import {
  calcularAccionesPedido,
  esPersonalAutorizado,
  puedeArmarRutas,
  puedeEditarInventario,
  puedeEjecutarRutas,
  puedeGestionarPedidosYTurnos,
  puedeVerInventario,
} from "../auth/permisos";

const FARMACEUTICO: UsuarioResumen = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "farmaceutico.centro@farmagestion.demo",
  rol: "EMPLEADO",
  cargo: "FARMACEUTICO",
  sedeId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  nombres: "Laura",
  apellidos: "Gómez",
};

const AUXILIAR: UsuarioResumen = {
  id: "22222222-2222-2222-2222-222222222222",
  email: "auxiliar.centro@farmagestion.demo",
  rol: "EMPLEADO",
  cargo: "AUXILIAR",
  sedeId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  nombres: "Mateo",
  apellidos: "López",
};

const DOMICILIARIO: UsuarioResumen = {
  id: "33333333-3333-3333-3333-333333333333",
  email: "domiciliario.centro@farmagestion.demo",
  rol: "EMPLEADO",
  cargo: "DOMICILIARIO",
  sedeId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  nombres: "Carlos",
  apellidos: "Ruiz",
};

const ADMIN: UsuarioResumen = {
  id: "44444444-4444-4444-4444-444444444444",
  email: "admin@farmagestion.demo",
  rol: "ADMIN",
  nombres: "Admin",
  apellidos: "FarmaGestión",
};

const PACIENTE: UsuarioResumen = {
  id: "55555555-5555-5555-5555-555555555555",
  email: "paciente1@farmagestion.demo",
  rol: "PACIENTE",
  nombres: "Ana",
  apellidos: "Ríos",
};

function jsonResponse(body: unknown, status = 200, contentType = "application/json"): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": contentType },
  });
}

describe("Panel de empleados · Reglas de roles, cliente tipado y errores problem+json", () => {
  it("aplica correctamente la matriz de permisos de 03 §3 y RN-EMP-04", () => {
    expect(esPersonalAutorizado(PACIENTE)).toBe(false);
    expect(esPersonalAutorizado(FARMACEUTICO)).toBe(true);
    expect(esPersonalAutorizado(AUXILIAR)).toBe(true);
    expect(esPersonalAutorizado(DOMICILIARIO)).toBe(true);
    expect(esPersonalAutorizado(ADMIN)).toBe(true);

    // Inventario
    expect(puedeVerInventario(AUXILIAR)).toBe(true);
    expect(puedeEditarInventario(AUXILIAR)).toBe(false);
    expect(puedeVerInventario(FARMACEUTICO)).toBe(true);
    expect(puedeEditarInventario(FARMACEUTICO)).toBe(true);
    expect(puedeVerInventario(DOMICILIARIO)).toBe(false);
    expect(puedeEditarInventario(DOMICILIARIO)).toBe(false);
    expect(puedeVerInventario(ADMIN)).toBe(true);
    expect(puedeEditarInventario(ADMIN)).toBe(true);

    // Pedidos y turnos
    expect(puedeGestionarPedidosYTurnos(AUXILIAR)).toBe(true);
    expect(puedeGestionarPedidosYTurnos(FARMACEUTICO)).toBe(true);
    expect(puedeGestionarPedidosYTurnos(DOMICILIARIO)).toBe(false);
    expect(puedeGestionarPedidosYTurnos(ADMIN)).toBe(true);

    // Domicilios y rutas (03 §3, CA-EMP-13)
    expect(puedeArmarRutas(AUXILIAR)).toBe(false);
    expect(puedeArmarRutas(FARMACEUTICO)).toBe(true);
    expect(puedeArmarRutas(DOMICILIARIO)).toBe(false);
    expect(puedeArmarRutas(ADMIN)).toBe(true);

    expect(puedeEjecutarRutas(AUXILIAR)).toBe(false);
    expect(puedeEjecutarRutas(FARMACEUTICO)).toBe(false);
    expect(puedeEjecutarRutas(DOMICILIARIO)).toBe(true);
    expect(puedeEjecutarRutas(ADMIN)).toBe(false);

    // RN-EMP-04: mientras esté EN_PREPARACION, solo quien lo tomó o ADMIN puede marcarlo LISTO/cancelarlo
    const pedidoEnPrep = {
      estado: "EN_PREPARACION" as const,
      modalidad: "RECOGER" as const,
      asignadoA: FARMACEUTICO.id,
    };

    const accionesPropietario = calcularAccionesPedido(FARMACEUTICO, pedidoEnPrep);
    expect(accionesPropietario.puedeMarcarListo).toBe(true);
    expect(accionesPropietario.puedeCancelar).toBe(true);
    expect(accionesPropietario.puedeAjustarFaltante).toBe(true);
    expect(accionesPropietario.bloqueadoPorOtroEmpleado).toBe(false);

    const accionesOtroEmpleado = calcularAccionesPedido(AUXILIAR, pedidoEnPrep);
    expect(accionesOtroEmpleado.puedeMarcarListo).toBe(false);
    expect(accionesOtroEmpleado.puedeCancelar).toBe(false);
    expect(accionesOtroEmpleado.bloqueadoPorOtroEmpleado).toBe(true);

    const accionesAdmin = calcularAccionesPedido(ADMIN, pedidoEnPrep);
    expect(accionesAdmin.puedeMarcarListo).toBe(true);
    expect(accionesAdmin.puedeCancelar).toBe(true);
    expect(accionesAdmin.bloqueadoPorOtroEmpleado).toBe(false);
  });

  it("CA_EMP_04 · flujo completo de pedido RECOGER (tomar, marcar LISTO y entregar con documento correcto)", async () => {
    const pedidoId = "9d2c0b7e-6a53-4f0e-9a0c-2f8f3d2a1b11";
    const token = "jwt-demo-token";

    const pedidoBase: PedidoDetalle = {
      id: pedidoId,
      codigo: "PED-2026-000001",
      estado: "RESERVADO",
      modalidad: "RECOGER",
      esParcial: false,
      sedeId: FARMACEUTICO.sedeId,
      sedeCodigo: "SEDE-CENTRO",
      sedeNombre: "Sede Centro",
      formulaCodigo: "FRM-2026-000001",
      pacienteNombre: "Ana María Ríos Gómez",
      pacienteTipoDocumento: "CC",
      pacienteDocumento: "1000000001",
      turno: {
        id: "77777777-7777-7777-7777-777777777777",
        codigo: "CEN-001",
        estado: "EN_ESPERA",
      },
      items: [
        {
          id: "88888888-8888-8888-8888-888888888888",
          medicamentoCodigo: "MED-0007",
          medicamentoNombre: "Losartán 50 mg tableta",
          cantidadSolicitada: 30,
          cantidadReservada: 30,
          cantidadEntregada: 0,
          estadoItem: "COMPLETO",
        },
      ],
      historial: [],
    };

    const llamadas: Array<{ url: string; method?: string; body?: unknown; auth?: string | null }> = [];

    const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      llamadas.push({
        url,
        method: init?.method,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
        auth: headers.get("Authorization"),
      });

      if (url.endsWith(`/api/v1/gestion/pedidos/${pedidoId}/tomar`)) {
        return jsonResponse({
          ...pedidoBase,
          estado: "EN_PREPARACION",
          asignadoA: FARMACEUTICO.id,
        });
      }
      if (url.endsWith(`/api/v1/gestion/pedidos/${pedidoId}/listo`)) {
        return jsonResponse({
          ...pedidoBase,
          estado: "LISTO",
          asignadoA: FARMACEUTICO.id,
        });
      }
      if (url.endsWith(`/api/v1/gestion/pedidos/${pedidoId}/entregar`)) {
        return jsonResponse({
          ...pedidoBase,
          estado: "ENTREGADO",
          asignadoA: FARMACEUTICO.id,
          turno: { ...pedidoBase.turno, estado: "ATENDIDO" },
          items: [{ ...pedidoBase.items![0], cantidadEntregada: 30 }],
        });
      }
      throw new Error(`URL inesperada: ${url}`);
    }) as unknown as typeof fetch;

    // 1. Estado inicial RESERVADO -> solo puede tomar o cancelar
    const accionesReservado = calcularAccionesPedido(FARMACEUTICO, pedidoBase);
    expect(accionesReservado.puedeTomar).toBe(true);
    expect(accionesReservado.puedeMarcarListo).toBe(false);
    expect(accionesReservado.puedeEntregar).toBe(false);

    const enPrep = await farmaApi.tomarPedido(
      pedidoId,
      { nota: "Preparando en mostrador" },
      { token, fetchImpl: mockFetch }
    );
    expect(enPrep.estado).toBe("EN_PREPARACION");
    expect(enPrep.asignadoA).toBe(FARMACEUTICO.id);

    // 2. Estado EN_PREPARACION -> el propietario puede marcar LISTO
    const accionesPrep = calcularAccionesPedido(FARMACEUTICO, enPrep);
    expect(accionesPrep.puedeMarcarListo).toBe(true);
    expect(accionesPrep.puedeEntregar).toBe(false);

    const listo = await farmaApi.marcarPedidoListo(
      pedidoId,
      { nota: "Verificado" },
      { token, fetchImpl: mockFetch }
    );
    expect(listo.estado).toBe("LISTO");

    // 3. Estado LISTO (RECOGER) -> puede entregar con verificación de documento
    const accionesListo = calcularAccionesPedido(FARMACEUTICO, listo);
    expect(accionesListo.puedeEntregar).toBe(true);

    const entregado = await farmaApi.entregarPedido(
      pedidoId,
      { documentoVerificado: "1000000001", nota: "Entregado en ventanilla" },
      { token, fetchImpl: mockFetch }
    );
    expect(entregado.estado).toBe("ENTREGADO");
    expect(entregado.turno?.estado).toBe("ATENDIDO");
    expect(entregado.items?.[0].cantidadEntregada).toBe(30);

    // 4. Estado ENTREGADO -> terminal, sin acciones de transición
    const accionesFinal = calcularAccionesPedido(FARMACEUTICO, entregado);
    expect(accionesFinal.puedeTomar).toBe(false);
    expect(accionesFinal.puedeMarcarListo).toBe(false);
    expect(accionesFinal.puedeEntregar).toBe(false);
    expect(accionesFinal.puedeCancelar).toBe(false);

    expect(llamadas).toHaveLength(3);
    expect(llamadas.every((c) => c.auth === `Bearer ${token}`)).toBe(true);
    expect(llamadas[2].body).toEqual({
      documentoVerificado: "1000000001",
      nota: "Entregado en ventanilla",
    });
  });

  it("maneja errores problem+json (CA-EMP-05 422 y CA-EMP-06 409) y notifica globalmente", async () => {
    const erroresRecibidos: ApiError[] = [];
    const desuscribir = suscribirErroresGlobales((err) => erroresRecibidos.push(err));

    const fetch422 = vi.fn(async () =>
      jsonResponse(
        {
          type: "https://farmagestion.co/errores/documento-no-coincide",
          title: "Documento incorrecto",
          status: 422,
          detail: "El documento verificado no coincide con el titular del pedido.",
          code: "DOCUMENTO_NO_COINCIDE",
        },
        422,
        "application/problem+json"
      )
    ) as unknown as typeof fetch;

    await expect(
      farmaApi.entregarPedido(
        "9d2c0b7e-6a53-4f0e-9a0c-2f8f3d2a1b11",
        { documentoVerificado: "9999999999" },
        { token: "jwt", fetchImpl: fetch422 }
      )
    ).rejects.toSatisfy((err: unknown) => {
      return (
        isApiError(err) &&
        err.status === 422 &&
        err.code === "DOCUMENTO_NO_COINCIDE" &&
        err.mensajeUsuario.includes("no coincide")
      );
    });

    const fetch409 = vi.fn(async () =>
      jsonResponse(
        {
          type: "https://farmagestion.co/errores/transicion-invalida",
          title: "Transición inválida",
          status: 409,
          detail: "Solo se pueden entregar por mostrador pedidos RECOGER en estado LISTO.",
          code: "TRANSICION_INVALIDA",
        },
        409,
        "application/problem+json"
      )
    ) as unknown as typeof fetch;

    await expect(
      farmaApi.entregarPedido(
        "9d2c0b7e-6a53-4f0e-9a0c-2f8f3d2a1b11",
        { documentoVerificado: "1000000001" },
        { token: "jwt", fetchImpl: fetch409 }
      )
    ).rejects.toSatisfy((err: unknown) => {
      return isApiError(err) && err.status === 409 && err.code === "TRANSICION_INVALIDA";
    });

    expect(erroresRecibidos.map((e) => e.code)).toEqual([
      "DOCUMENTO_NO_COINCIDE",
      "TRANSICION_INVALIDA",
    ]);

    desuscribir();
  });

  it("activa el estado 'Despertando el servicio…' cuando una petición tarda más del umbral y lo apaga al completar", async () => {
    vi.useFakeTimers();
    const estados: boolean[] = [];
    const desuscribir = suscribirEstadoLento((v) => estados.push(v));

    let resolverFetch!: (value: Response) => void;
    const fetchLento = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolverFetch = resolve;
        })
    ) as unknown as typeof fetch;

    const promesa = farmaApi.listarSedes({
      fetchImpl: fetchLento,
      slowThresholdMs: 5000,
    });

    await vi.advanceTimersByTimeAsync(4999);
    expect(estados[estados.length - 1]).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(estados[estados.length - 1]).toBe(true);

    resolverFetch(jsonResponse([]));
    await promesa;
    expect(estados[estados.length - 1]).toBe(false);

    desuscribir();
    vi.useRealTimers();
  });

  it("CA_EMP_11 y CA_EMP_12 · cliente tipado de domicilios (crear, reordenar, iniciar y marcar parada fallida)", async () => {
    const rutaId = "aaaaaaaa-1111-2222-3333-bbbbbbbbbbbb";
    const parada1Id = "11111111-aaaa-bbbb-cccc-000000000001";
    const parada2Id = "11111111-aaaa-bbbb-cccc-000000000002";

    const llamadas: Array<{ url: string; method?: string; body?: unknown }> = [];
    const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      llamadas.push({
        url,
        method: init?.method,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });

      if (url.endsWith("/api/v1/gestion/rutas") && init?.method === "POST") {
        return jsonResponse(
          {
            id: rutaId,
            estado: "PLANEADA",
            distanciaKm: 4.52,
            paradas: [
              { id: parada1Id, orden: 1, estado: "PENDIENTE", distanciaKmDesdeAnterior: 2.1 },
              { id: parada2Id, orden: 2, estado: "PENDIENTE", distanciaKmDesdeAnterior: 2.42 },
            ],
          },
          201
        );
      }
      if (url.endsWith(`/api/v1/gestion/rutas/${rutaId}/orden`)) {
        return jsonResponse({
          id: rutaId,
          estado: "PLANEADA",
          distanciaKm: 4.95,
          paradas: [
            { id: parada2Id, orden: 1, estado: "PENDIENTE", distanciaKmDesdeAnterior: 2.8 },
            { id: parada1Id, orden: 2, estado: "PENDIENTE", distanciaKmDesdeAnterior: 2.15 },
          ],
        });
      }
      if (url.endsWith(`/api/v1/gestion/rutas/${rutaId}/iniciar`)) {
        return jsonResponse({
          id: rutaId,
          estado: "EN_CURSO",
          distanciaKm: 4.95,
          paradas: [
            { id: parada2Id, orden: 1, estado: "PENDIENTE", estadoPedido: "EN_RUTA" },
            { id: parada1Id, orden: 2, estado: "PENDIENTE", estadoPedido: "EN_RUTA" },
          ],
        });
      }
      if (url.endsWith(`/api/v1/gestion/rutas/${rutaId}/paradas/${parada2Id}/fallida`)) {
        return jsonResponse({
          id: rutaId,
          estado: "EN_CURSO",
          paradas: [
            {
              id: parada2Id,
              orden: 1,
              estado: "FALLIDA",
              estadoPedido: "CANCELADO",
              intentosEntrega: 2,
            },
            { id: parada1Id, orden: 2, estado: "PENDIENTE", estadoPedido: "EN_RUTA" },
          ],
        });
      }
      throw new Error(`URL inesperada: ${url}`);
    }) as unknown as typeof fetch;

    const creada = await farmaApi.crearRuta(
      {
        domiciliarioId: DOMICILIARIO.id!,
        pedidoIds: ["p1", "p2"],
      },
      {},
      { token: "jwt-farm", fetchImpl: mockFetch }
    );
    expect(creada.estado).toBe("PLANEADA");
    expect(creada.distanciaKm).toBe(4.52);

    const reordenada = await farmaApi.reordenarRuta(
      rutaId,
      { paradaIds: [parada2Id, parada1Id] },
      { token: "jwt-farm", fetchImpl: mockFetch }
    );
    expect(reordenada.paradas?.[0].id).toBe(parada2Id);

    const iniciada = await farmaApi.iniciarRuta(rutaId, {
      token: "jwt-farm",
      fetchImpl: mockFetch,
    });
    expect(iniciada.estado).toBe("EN_CURSO");

    const fallida = await farmaApi.marcarParadaFallida(
      rutaId,
      parada2Id,
      { motivo: "Sin respuesta en segundo intento" },
      { token: "jwt-dom", fetchImpl: mockFetch }
    );
    expect(fallida.paradas?.[0].estado).toBe("FALLIDA");
    expect(fallida.paradas?.[0].estadoPedido).toBe("CANCELADO");
    expect(llamadas).toHaveLength(4);
  });
});
