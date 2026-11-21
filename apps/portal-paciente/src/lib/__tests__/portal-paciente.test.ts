import { describe, expect, it, vi } from "vitest";
import {
  portalApi,
  suscribirErroresGlobales,
  suscribirEstadoLento,
  suscribirNoAutenticado,
  type FormulaDetalle,
  type PedidoDetalle,
} from "../api/client";
import { ApiError, isApiError } from "../api/problem";
import { crearSesionDesdeAuth, esPaciente, sesionVigente } from "../auth/session";
import {
  ETIQUETA_NIVEL_DISPONIBILIDAD,
  puedeCancelarPedidoPaciente,
} from "../format";

function jsonResponse(
  body: unknown,
  status = 200,
  contentType = "application/json"
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": contentType },
  });
}

describe("Portal del paciente · Cliente OpenAPI, errores problem+json y flujos CA-PAC", () => {
  it("CA_PAC_01 · búsqueda pública de medicamentos y disponibilidad por niveles sin cantidades exactas", async () => {
    const medId = "e8a20000-0000-0000-0000-000000000007";
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/catalogo/medicamentos?q=losart")) {
        return jsonResponse({
          content: [
            {
              id: medId,
              codigo: "MED-0007",
              nombre: "Losartán 50 mg tableta",
              principioActivo: "Losartán potásico",
              presentacion: "Caja x 30 tabletas",
            },
          ],
          page: 0,
          size: 10,
          totalElements: 1,
        });
      }
      if (url.endsWith(`/api/v1/catalogo/medicamentos/${medId}/disponibilidad`)) {
        return jsonResponse({
          medicamentoId: medId,
          codigo: "MED-0007",
          nombre: "Losartán 50 mg tableta",
          principioActivo: "Losartán potásico",
          presentacion: "Caja x 30 tabletas",
          sedes: [
            {
              sedeId: "b41c0000-0000-0000-0000-000000000001",
              codigo: "SEDE-CENTRO",
              nombre: "Sede Centro",
              nivel: "DISPONIBLE",
            },
            {
              sedeId: "b41c0000-0000-0000-0000-000000000002",
              codigo: "SEDE-BELLO",
              nombre: "Sede Bello",
              nivel: "POCAS_UNIDADES",
            },
            {
              sedeId: "b41c0000-0000-0000-0000-000000000003",
              codigo: "SEDE-ITAGUI",
              nombre: "Sede Itagüí",
              nivel: "AGOTADO",
            },
          ],
        });
      }
      throw new Error(`URL inesperada: ${url}`);
    }) as unknown as typeof fetch;

    const pagina = await portalApi.buscarMedicamentos(
      { q: "losartán", page: 0, size: 10 },
      { fetchImpl: mockFetch }
    );
    expect(pagina.content).toHaveLength(1);

    const disp = await portalApi.consultarDisponibilidadMedicamento(medId, {
      fetchImpl: mockFetch,
    });
    expect(disp.sedes?.map((s) => s.nivel)).toEqual([
      "DISPONIBLE",
      "POCAS_UNIDADES",
      "AGOTADO",
    ]);
    expect(ETIQUETA_NIVEL_DISPONIBILIDAD.POCAS_UNIDADES).toBe("Pocas unidades");
  });

  it("CA_PAC_02 · vincular fórmula válida y consultar su detalle con saldos y matriz", async () => {
    const formulaId = "6a0f0000-0000-0000-0000-000000000001";
    const formulaEsperada: FormulaDetalle = {
      id: formulaId,
      codigoExterno: "FRM-2026-000001",
      estadoExterno: "EMITIDA",
      fechaEmision: "2026-11-20",
      fechaVencimiento: "2026-12-20",
      vigente: true,
      medicoNombre: "Dr. Carlos Mejía",
      items: [
        {
          id: "11111111-1111-1111-1111-111111111111",
          medicamentoId: "e8a20000-0000-0000-0000-000000000007",
          medicamentoCodigo: "MED-0007",
          medicamentoNombre: "Losartán 50 mg tableta",
          cantidadAutorizada: 60,
          cantidadDispensada: 0,
          cantidadReservadaActiva: 0,
          cantidadPendiente: 60,
          disponibilidadPorSede: [
            {
              sedeId: "b41c0000-0000-0000-0000-000000000001",
              sedeCodigo: "SEDE-CENTRO",
              sedeNombre: "Sede Centro",
              nivel: "DISPONIBLE",
            },
          ],
        },
      ],
    };

    const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/v1/pacientes/me/formulas") && init?.method === "POST") {
        expect(JSON.parse(String(init.body))).toEqual({ codigo: "FRM-2026-000001" });
        return jsonResponse(formulaEsperada, 201);
      }
      if (url.endsWith(`/api/v1/pacientes/me/formulas/${formulaId}`)) {
        return jsonResponse(formulaEsperada, 200);
      }
      throw new Error(`URL inesperada: ${url}`);
    }) as unknown as typeof fetch;

    const vinculada = await portalApi.vincularFormula(
      { codigo: "FRM-2026-000001" },
      { token: "jwt-pac", fetchImpl: mockFetch }
    );
    expect(vinculada.codigoExterno).toBe("FRM-2026-000001");
    expect(vinculada.items?.[0].cantidadPendiente).toBe(60);

    const detalle = await portalApi.obtenerDetalleFormula(formulaId, {
      token: "jwt-pac",
      fetchImpl: mockFetch,
    });
    expect(detalle.items?.[0].disponibilidadPorSede?.[0].nivel).toBe("DISPONIBLE");
  });

  it("CA_PAC_03 · vincular fórmula ajena responde 404 con mensaje genérico RN-PAC-01", async () => {
    const mockFetch = vi.fn(async () =>
      jsonResponse(
        {
          title: "Fórmula no encontrada",
          status: 404,
          detail: "No encontramos una fórmula con esos datos.",
          code: "FORMULA_NO_ENCONTRADA",
        },
        404,
        "application/problem+json"
      )
    ) as unknown as typeof fetch;

    await expect(
      portalApi.vincularFormula(
        { codigo: "FRM-AJENA-999" },
        { token: "jwt-pac", fetchImpl: mockFetch, notifyGlobalError: false }
      )
    ).rejects.toSatisfy(
      (err: unknown) =>
        isApiError(err) &&
        err.status === 404 &&
        err.code === "FORMULA_NO_ENCONTRADA" &&
        err.mensajeUsuario === "No encontramos una fórmula con esos datos."
    );
  });

  it("CA_PAC_04 · crear pedido RECOGER con franja con cupo genera turno y estado RESERVADO", async () => {
    const sedeId = "b41c0000-0000-0000-0000-000000000001";
    const formulaId = "6a0f0000-0000-0000-0000-000000000001";
    const medId = "e8a20000-0000-0000-0000-000000000007";

    const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes(`/api/v1/pacientes/me/sedes/${sedeId}/franjas`)) {
        return jsonResponse({
          sedeId,
          sedeCodigo: "SEDE-CENTRO",
          sedeNombre: "Sede Centro",
          fecha: "2026-11-22",
          duracionFranjaMin: 30,
          capacidadFranja: 6,
          franjas: [
            {
              horaInicio: "10:00:00",
              horaFin: "10:30:00",
              franjaInicio: "2026-11-22T10:00:00-05:00",
              capacidad: 6,
              ocupados: 1,
              cuposDisponibles: 5,
              disponible: true,
            },
          ],
        });
      }
      if (url.endsWith("/api/v1/pacientes/me/pedidos") && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        expect(body.modalidad).toBe("RECOGER");
        expect(body.aceptaParcial).toBe(false);
        const resp: PedidoDetalle = {
          id: "9d2c0b7e-6a53-4f0e-9a0c-2f8f3d2a1b11",
          codigo: "PED-2026-000010",
          estado: "RESERVADO",
          modalidad: "RECOGER",
          esParcial: false,
          sedeId,
          sedeCodigo: "SEDE-CENTRO",
          sedeNombre: "Sede Centro",
          formulaId,
          formulaCodigo: "FRM-2026-000001",
          turno: {
            id: "77777777-7777-7777-7777-777777777777",
            codigo: "CEN-001",
            fecha: "2026-11-22",
            franjaInicio: "10:00:00",
            estado: "EN_ESPERA",
          },
          items: [
            {
              medicamentoId: medId,
              cantidadSolicitada: 30,
              cantidadReservada: 30,
              cantidadEntregada: 0,
              estadoItem: "COMPLETO",
            },
          ],
          historial: [{ estadoNuevo: "RESERVADO", nota: "Pedido creado" }],
        };
        return jsonResponse(resp, 201);
      }
      throw new Error(`URL inesperada: ${url}`);
    }) as unknown as typeof fetch;

    const franjas = await portalApi.consultarFranjas(sedeId, "2026-11-22", {
      token: "jwt-pac",
      fetchImpl: mockFetch,
    });
    expect(franjas.franjas?.[0].disponible).toBe(true);

    const pedido = await portalApi.crearPedido(
      {
        formulaId,
        sedeId,
        modalidad: "RECOGER",
        franjaInicio: franjas.franjas![0].franjaInicio,
        aceptaParcial: false,
        items: [{ medicamentoId: medId, cantidad: 30 }],
      },
      { token: "jwt-pac", fetchImpl: mockFetch }
    );

    expect(pedido.estado).toBe("RESERVADO");
    expect(pedido.esParcial).toBe(false);
    expect(pedido.turno?.codigo).toBe("CEN-001");
  });

  it("CA_PAC_05 y CA_PAC_06 · faltante sin aceptar parcial devuelve 409 STOCK_INSUFICIENTE con ítems y aceptar parcial crea el pedido", async () => {
    const sedeId = "b41c0000-0000-0000-0000-000000000001";
    const formulaId = "6a0f0000-0000-0000-0000-000000000001";
    const med1 = "e8a20000-0000-0000-0000-000000000001";
    const med2 = "e8a20000-0000-0000-0000-000000000002";

    const mockFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      if (!body.aceptaParcial) {
        return jsonResponse(
          {
            type: "https://farmagestion.co/errores/stock-insuficiente",
            title: "Stock insuficiente",
            status: 409,
            detail: "No hay stock suficiente para completar todos los ítems solicitados.",
            code: "STOCK_INSUFICIENTE",
            items: [
              {
                medicamentoId: med1,
                solicitada: 30,
                disponible: 10,
                reservada: 10,
                estadoItem: "PARCIAL",
              },
              {
                medicamentoId: med2,
                solicitada: 20,
                disponible: 0,
                reservada: 0,
                estadoItem: "AGOTADO",
              },
            ],
          },
          409,
          "application/problem+json"
        );
      }

      return jsonResponse(
        {
          id: "9d2c0b7e-6a53-4f0e-9a0c-2f8f3d2a1b22",
          codigo: "PED-2026-000011",
          estado: "RESERVADO",
          modalidad: "RECOGER",
          esParcial: true,
          turno: { codigo: "CEN-002", estado: "EN_ESPERA" },
          items: [
            {
              medicamentoId: med1,
              cantidadSolicitada: 30,
              cantidadReservada: 10,
              cantidadEntregada: 0,
              estadoItem: "PARCIAL",
            },
            {
              medicamentoId: med2,
              cantidadSolicitada: 20,
              cantidadReservada: 0,
              cantidadEntregada: 0,
              estadoItem: "AGOTADO",
            },
          ],
          historial: [],
        },
        201
      );
    }) as unknown as typeof fetch;

    // CA-PAC-05: aceptaParcial = false -> 409 STOCK_INSUFICIENTE con detalle por ítem
    let errorCapturado: ApiError | null = null;
    try {
      await portalApi.crearPedido(
        {
          formulaId,
          sedeId,
          modalidad: "RECOGER",
          franjaInicio: "2026-11-22T10:00:00-05:00",
          aceptaParcial: false,
          items: [
            { medicamentoId: med1, cantidad: 30 },
            { medicamentoId: med2, cantidad: 20 },
          ],
        },
        { token: "jwt-pac", fetchImpl: mockFetch, notifyGlobalError: false }
      );
    } catch (err) {
      if (isApiError(err)) errorCapturado = err;
    }

    expect(errorCapturado).not.toBeNull();
    expect(errorCapturado?.status).toBe(409);
    expect(errorCapturado?.code).toBe("STOCK_INSUFICIENTE");
    expect(errorCapturado?.stockInsuficienteItems).toHaveLength(2);
    expect(errorCapturado?.stockInsuficienteItems?.[0].estadoItem).toBe("PARCIAL");
    expect(errorCapturado?.stockInsuficienteItems?.[1].estadoItem).toBe("AGOTADO");

    // CA-PAC-06: reenvía con aceptaParcial = true -> crea pedido parcial
    const parcial = await portalApi.crearPedido(
      {
        formulaId,
        sedeId,
        modalidad: "RECOGER",
        franjaInicio: "2026-11-22T10:00:00-05:00",
        aceptaParcial: true,
        items: [
          { medicamentoId: med1, cantidad: 30 },
          { medicamentoId: med2, cantidad: 20 },
        ],
      },
      { token: "jwt-pac", fetchImpl: mockFetch }
    );

    expect(parcial.esParcial).toBe(true);
    expect(parcial.items?.[0].estadoItem).toBe("PARCIAL");
    expect(parcial.items?.[1].estadoItem).toBe("AGOTADO");
  });

  it("CA_PAC_08 · cancelar pedido RESERVADO pasa pedido y turno a CANCELADO y respeta RN-PAC-06", async () => {
    expect(puedeCancelarPedidoPaciente("RESERVADO")).toBe(true);
    expect(puedeCancelarPedidoPaciente("EN_PREPARACION")).toBe(true);
    expect(puedeCancelarPedidoPaciente("LISTO")).toBe(true);
    expect(puedeCancelarPedidoPaciente("EN_RUTA")).toBe(false);
    expect(puedeCancelarPedidoPaciente("ENTREGADO")).toBe(false);
    expect(puedeCancelarPedidoPaciente("CANCELADO")).toBe(false);
    expect(puedeCancelarPedidoPaciente("VENCIDO")).toBe(false);

    const pedidoId = "9d2c0b7e-6a53-4f0e-9a0c-2f8f3d2a1b11";
    const mockFetch = vi.fn(async () =>
      jsonResponse({
        id: pedidoId,
        codigo: "PED-2026-000010",
        estado: "CANCELADO",
        turno: { codigo: "CEN-001", estado: "CANCELADO" },
        items: [],
        historial: [
          {
            estadoAnterior: "RESERVADO",
            estadoNuevo: "CANCELADO",
            nota: "Cancelado por el paciente",
          },
        ],
      })
    ) as unknown as typeof fetch;

    const cancelado = await portalApi.cancelarPedido(
      pedidoId,
      { nota: "Cancelado por el paciente" },
      { token: "jwt-pac", fetchImpl: mockFetch }
    );

    expect(cancelado.estado).toBe("CANCELADO");
    expect(cancelado.turno?.estado).toBe("CANCELADO");
  });

  it("CA_PAC_12 · descargar PDF autenticado retorna Blob application/pdf y nombre de archivo", async () => {
    const formulaId = "6a0f0000-0000-0000-0000-000000000001";
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4

    const mockFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer jwt-pac");
      return new Response(pdfBytes, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="formula-FRM-2026-000001.pdf"',
        },
      });
    }) as unknown as typeof fetch;

    const resultado = await portalApi.descargarFormulaPdf(
      formulaId,
      "FRM-2026-000001",
      { token: "jwt-pac", fetchImpl: mockFetch }
    );

    expect(resultado.contentType).toContain("application/pdf");
    expect(resultado.filename).toBe("formula-FRM-2026-000001.pdf");
    expect(resultado.blob.size).toBe(pdfBytes.byteLength);
  });

  it("CA_PAC_10 · pedido DOMICILIO con dirección y coordenadas muestra EN_RUTA con ruta asignada y no permite cancelar", async () => {
    const pedidoId = "d0000000-0000-0000-0000-000000000010";
    let bodyEnviado: unknown = null;

    const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/v1/pacientes/me/pedidos") && init?.method === "POST") {
        bodyEnviado = JSON.parse(String(init.body));
        return jsonResponse(
          {
            id: pedidoId,
            codigo: "PED-2026-000050",
            estado: "RESERVADO",
            modalidad: "DOMICILIO",
            direccionEntrega: "Carrera 43A # 10-25, Medellín",
            latitudEntrega: 6.21025,
            longitudEntrega: -75.5712,
            items: [],
            historial: [],
          },
          201
        );
      }
      if (url.endsWith(`/api/v1/pacientes/me/pedidos/${pedidoId}`)) {
        return jsonResponse({
          id: pedidoId,
          codigo: "PED-2026-000050",
          estado: "EN_RUTA",
          modalidad: "DOMICILIO",
          direccionEntrega: "Carrera 43A # 10-25, Medellín",
          latitudEntrega: 6.21025,
          longitudEntrega: -75.5712,
          intentosEntrega: 0,
          ruta: {
            rutaId: "r0000000-0000-0000-0000-000000000001",
            fecha: "2026-11-21",
            estadoRuta: "EN_CURSO",
            orden: 2,
            estadoParada: "PENDIENTE",
            domiciliarioNombre: "Andrés Mejía",
            distanciaKmTotal: 4.35,
          },
          items: [],
          historial: [
            { estadoAnterior: "LISTO", estadoNuevo: "EN_RUTA" },
          ],
        });
      }
      throw new Error(`URL inesperada: ${url}`);
    }) as unknown as typeof fetch;

    const creado = await portalApi.crearPedido(
      {
        formulaId: "6a0f0000-0000-0000-0000-000000000001",
        sedeId: "b41c0000-0000-0000-0000-000000000001",
        modalidad: "DOMICILIO",
        direccionEntrega: "Carrera 43A # 10-25, Medellín",
        latitudEntrega: 6.21025,
        longitudEntrega: -75.5712,
        aceptaParcial: false,
        items: [{ medicamentoId: "e8a20000-0000-0000-0000-000000000001", cantidad: 10 }],
      },
      { token: "jwt-pac", fetchImpl: mockFetch }
    );

    expect(creado.modalidad).toBe("DOMICILIO");
    expect(bodyEnviado).toMatchObject({
      modalidad: "DOMICILIO",
      direccionEntrega: "Carrera 43A # 10-25, Medellín",
      latitudEntrega: 6.21025,
      longitudEntrega: -75.5712,
    });

    const detalleEnRuta = await portalApi.obtenerDetallePedido(pedidoId, {
      token: "jwt-pac",
      fetchImpl: mockFetch,
    });
    expect(detalleEnRuta.estado).toBe("EN_RUTA");
    expect(detalleEnRuta.ruta?.estadoRuta).toBe("EN_CURSO");
    expect(detalleEnRuta.ruta?.domiciliarioNombre).toBe("Andrés Mejía");
    expect(puedeCancelarPedidoPaciente(detalleEnRuta.estado)).toBe(false);
  });

  it("activa 'Despertando el servicio…' tras 5 s, maneja 401 y valida rol PACIENTE", async () => {
    // Validación de rol PACIENTE en sesión
    const sesionPaciente = crearSesionDesdeAuth({
      accessToken: "jwt-ok",
      expiresIn: 7200,
      usuario: { id: "u1", rol: "PACIENTE", nombres: "Ana" },
    });
    expect(esPaciente(sesionPaciente.usuario)).toBe(true);
    expect(sesionVigente(sesionPaciente)).toBe(true);

    const sesionEmpleado = crearSesionDesdeAuth({
      accessToken: "jwt-emp",
      expiresIn: 7200,
      usuario: { id: "u2", rol: "EMPLEADO", nombres: "Laura" },
    });
    expect(esPaciente(sesionEmpleado.usuario)).toBe(false);
    expect(sesionVigente(sesionEmpleado)).toBe(false);

    // 401 dispara suscribirNoAutenticado y suscribirErroresGlobales
    const unauthCalls: string[] = [];
    const globalErrs: string[] = [];
    const unsubUnauth = suscribirNoAutenticado((e) => unauthCalls.push(e.code));
    const unsubErr = suscribirErroresGlobales((e) => globalErrs.push(e.code));

    const fetch401 = vi.fn(async () =>
      jsonResponse(
        {
          title: "No autenticado",
          status: 401,
          detail: "Token expirado",
          code: "NO_AUTENTICADO",
        },
        401,
        "application/problem+json"
      )
    ) as unknown as typeof fetch;

    await expect(
      portalApi.listarFormulas({ token: "jwt-expirado", fetchImpl: fetch401 })
    ).rejects.toBeInstanceOf(ApiError);

    expect(unauthCalls).toEqual(["NO_AUTENTICADO"]);
    expect(globalErrs).toEqual(["NO_AUTENTICADO"]);
    unsubUnauth();
    unsubErr();

    // Cold start > 5000 ms
    vi.useFakeTimers();
    const estados: boolean[] = [];
    const unsubSlow = suscribirEstadoLento((v) => estados.push(v));

    let resolver!: (res: Response) => void;
    const fetchLento = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolver = resolve;
        })
    ) as unknown as typeof fetch;

    const promesa = portalApi.listarSedes({
      fetchImpl: fetchLento,
      slowThresholdMs: 5000,
    });

    await vi.advanceTimersByTimeAsync(4999);
    expect(estados[estados.length - 1]).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(estados[estados.length - 1]).toBe(true);

    resolver(jsonResponse([]));
    await promesa;
    expect(estados[estados.length - 1]).toBe(false);

    unsubSlow();
    vi.useRealTimers();
  });
});
