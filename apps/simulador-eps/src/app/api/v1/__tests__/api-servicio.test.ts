import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { load as loadYaml } from "js-yaml";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET as getHealth } from "../health/route";
import { GET as getFormula } from "../formulas/[codigo]/route";
import { GET as getFormulaPdf } from "../formulas/[codigo]/pdf/route";
import { POST as postDispensacion } from "../formulas/[codigo]/dispensaciones/route";
import { generarCodigoFormula } from "@/lib/formula-codigo";
import { prisma } from "@/lib/prisma";

const API_KEY = "test-api-key-simulador-eps";

interface OpenApiDoc {
  components: {
    schemas: Record<string, unknown>;
  };
}

function crearValidadorOpenApi() {
  const contractPath = path.resolve(
    process.cwd(),
    "../../contracts/eps-simulador.openapi.yaml"
  );
  const spec = loadYaml(readFileSync(contractPath, "utf-8")) as OpenApiDoc;
  const ajv = new Ajv({ strict: false, allErrors: true });
  addFormats(ajv);

  // Convertir nullable: true de OpenAPI 3.0 a type: [T, "null"] para Ajv
  const normalizar = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(normalizar);
    if (node && typeof node === "object") {
      const obj = { ...(node as Record<string, unknown>) };
      if (obj.nullable === true && typeof obj.type === "string") {
        obj.type = [obj.type, "null"];
        delete obj.nullable;
      }
      for (const key of Object.keys(obj)) {
        obj[key] = normalizar(obj[key]);
      }
      return obj;
    }
    return node;
  };

  const schemas = normalizar(spec.components.schemas) as Record<
    string,
    Record<string, unknown>
  >;

  ajv.addSchema({
    $id: "openapi.json",
    components: { schemas },
  });

  return (schemaName: string, data: unknown) => {
    const validate = ajv.compile({
      $ref: `openapi.json#/components/schemas/${schemaName}`,
    });
    const ok = validate(data);
    if (!ok) {
      throw new Error(
        `Validación OpenAPI falló para ${schemaName}: ${JSON.stringify(validate.errors)}`
      );
    }
  };
}

const validarContraContrato = crearValidadorOpenApi();

describe("Simulador EPS — API de servicio (CA-EPS-02 a CA-EPS-08)", () => {
  let medicoId: string;
  let pacienteId: string;
  const pacienteDoc = "9001234567";
  const formulasCreadas: string[] = [];

  beforeAll(async () => {
    const medico = await prisma.medico.findFirstOrThrow();
    medicoId = medico.id;

    const paciente = await prisma.pacienteEps.upsert({
      where: {
        tipoDocumento_documento: {
          tipoDocumento: "CC",
          documento: pacienteDoc,
        },
      },
      update: {},
      create: {
        tipoDocumento: "CC",
        documento: pacienteDoc,
        nombres: "Paciente",
        apellidos: "Prueba P3",
        fechaNacimiento: new Date("1990-05-15T00:00:00Z"),
        eps: "EPS Simulada",
        telefono: "3000000000",
      },
    });
    pacienteId = paciente.id;
  });

  beforeEach(async () => {
    if (formulasCreadas.length > 0) {
      await prisma.dispensacion.deleteMany({
        where: { formulaId: { in: formulasCreadas } },
      });
      await prisma.formula.deleteMany({
        where: { id: { in: formulasCreadas } },
      });
      formulasCreadas.length = 0;
    }
  });

  afterAll(async () => {
    if (formulasCreadas.length > 0) {
      await prisma.dispensacion.deleteMany({
        where: { formulaId: { in: formulasCreadas } },
      });
      await prisma.formula.deleteMany({
        where: { id: { in: formulasCreadas } },
      });
    }
    await prisma.pacienteEps.deleteMany({
      where: { id: pacienteId },
    });
    await prisma.$disconnect();
  });

  async function crearFormulaPrueba(opts?: {
    estado?: string;
    diasVencimiento?: number;
    items?: Array<{
      medicamentoCodigo: string;
      cantidadAutorizada: number;
      cantidadDispensada?: number;
    }>;
  }) {
    const codigo = await generarCodigoFormula(prisma);
    const hoy = new Date();
    const emision = new Date(
      Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate())
    );
    const vencimiento = new Date(emision);
    vencimiento.setUTCDate(
      vencimiento.getUTCDate() + (opts?.diasVencimiento ?? 30)
    );

    const items = opts?.items ?? [
      { medicamentoCodigo: "MED-0004", cantidadAutorizada: 60, cantidadDispensada: 0 },
    ];

    const formula = await prisma.formula.create({
      data: {
        codigo,
        pacienteId,
        medicoId,
        fechaEmision: emision,
        fechaVencimiento: vencimiento,
        estado: opts?.estado ?? "EMITIDA",
        observaciones: "Control en 30 días",
        items: {
          create: items.map((i) => ({
            medicamentoCodigo: i.medicamentoCodigo,
            dosis: "1 tableta",
            frecuencia: "cada 12 horas",
            duracionDias: 30,
            cantidadAutorizada: i.cantidadAutorizada,
            cantidadDispensada: i.cantidadDispensada ?? 0,
          })),
        },
      },
    });
    formulasCreadas.push(formula.id);
    return formula;
  }

  it("GET /api/v1/health responde 200 ok sin autenticación y cumple OpenAPI", async () => {
    const res = await getHealth();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
    validarContraContrato("HealthResponse", body);
  });

  it("generarCodigoFormula usa secuencia de BD con formato FRM-{año}-{6 dígitos}", async () => {
    const c1 = await generarCodigoFormula(prisma);
    const c2 = await generarCodigoFormula(prisma);
    expect(c1).toMatch(/^FRM-\d{4}-\d{6}$/);
    expect(c2).toMatch(/^FRM-\d{4}-\d{6}$/);
    expect(c1).not.toBe(c2);
  });

  it("CA_EPS_02: consulta con documento correcto devuelve 200 con ítems y saldos", async () => {
    const formula = await crearFormulaPrueba();
    const req = new NextRequest(
      `http://localhost:3000/api/v1/formulas/${formula.codigo}?documento=${pacienteDoc}`,
      { headers: { "X-API-Key": API_KEY } }
    );

    const res = await getFormula(req, {
      params: Promise.resolve({ codigo: formula.codigo }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.codigo).toBe(formula.codigo);
    expect(body.estado).toBe("EMITIDA");
    expect(body.paciente.documento).toBe(pacienteDoc);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].cantidadAutorizada).toBe(60);
    expect(body.items[0].cantidadDispensada).toBe(0);
    validarContraContrato("FormulaResponse", body);
  });

  it("CA_EPS_03: consulta con documento incorrecto devuelve 404 idéntico a código inexistente", async () => {
    const formula = await crearFormulaPrueba();

    const reqDocIncorrecto = new NextRequest(
      `http://localhost:3000/api/v1/formulas/${formula.codigo}?documento=0000000000`,
      { headers: { "X-API-Key": API_KEY } }
    );
    const resDocIncorrecto = await getFormula(reqDocIncorrecto, {
      params: Promise.resolve({ codigo: formula.codigo }),
    });

    const reqInexistente = new NextRequest(
      `http://localhost:3000/api/v1/formulas/FRM-2026-999999?documento=${pacienteDoc}`,
      { headers: { "X-API-Key": API_KEY } }
    );
    const resInexistente = await getFormula(reqInexistente, {
      params: Promise.resolve({ codigo: "FRM-2026-999999" }),
    });

    expect(resDocIncorrecto.status).toBe(404);
    expect(resInexistente.status).toBe(404);
    expect(resDocIncorrecto.headers.get("content-type")).toContain(
      "application/problem+json"
    );

    const bodyDoc = await resDocIncorrecto.json();
    const bodyInex = await resInexistente.json();
    expect(bodyDoc.code).toBe("FORMULA_NO_ENCONTRADA");
    expect(bodyDoc).toEqual(bodyInex);
    validarContraContrato("ProblemDetail", bodyDoc);
  });

  it("CA_EPS_04: dispensación parcial de 20 sobre 60 actualiza a PARCIALMENTE_DISPENSADA", async () => {
    const formula = await crearFormulaPrueba({
      items: [{ medicamentoCodigo: "MED-0004", cantidadAutorizada: 60 }],
    });

    const req = new NextRequest(
      `http://localhost:3000/api/v1/formulas/${formula.codigo}/dispensaciones`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
          "Idempotency-Key": randomUUID(),
        },
        body: JSON.stringify({
          pedidoRef: randomUUID(),
          sedeCodigo: "SEDE-CENTRO",
          fecha: new Date().toISOString(),
          items: [{ medicamentoCodigo: "MED-0004", cantidad: 20 }],
        }),
      }
    );

    const res = await postDispensacion(req, {
      params: Promise.resolve({ codigo: formula.codigo }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.estado).toBe("PARCIALMENTE_DISPENSADA");
    expect(body.items[0].cantidadDispensada).toBe(20);
    validarContraContrato("FormulaResponse", body);

    // Completar los 40 restantes -> DISPENSADA (RF-EPS-10)
    const req2 = new NextRequest(
      `http://localhost:3000/api/v1/formulas/${formula.codigo}/dispensaciones`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
          "Idempotency-Key": randomUUID(),
        },
        body: JSON.stringify({
          pedidoRef: randomUUID(),
          sedeCodigo: "SEDE-CENTRO",
          fecha: new Date().toISOString(),
          items: [{ medicamentoCodigo: "MED-0004", cantidad: 40 }],
        }),
      }
    );

    const res2 = await postDispensacion(req2, {
      params: Promise.resolve({ codigo: formula.codigo }),
    });
    expect(res2.status).toBe(201);
    const body2 = await res2.json();
    expect(body2.estado).toBe("DISPENSADA");
    expect(body2.items[0].cantidadDispensada).toBe(60);
    validarContraContrato("FormulaResponse", body2);
  });

  it("CA_EPS_05: exceso sobre lo autorizado responde 409 y no altera ningún ítem (RN-EPS-06)", async () => {
    const formula = await crearFormulaPrueba({
      estado: "PARCIALMENTE_DISPENSADA",
      items: [
        {
          medicamentoCodigo: "MED-0001",
          cantidadAutorizada: 30,
          cantidadDispensada: 0,
        },
        {
          medicamentoCodigo: "MED-0004",
          cantidadAutorizada: 60,
          cantidadDispensada: 50,
        },
      ],
    });

    const req = new NextRequest(
      `http://localhost:3000/api/v1/formulas/${formula.codigo}/dispensaciones`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
          "Idempotency-Key": randomUUID(),
        },
        body: JSON.stringify({
          pedidoRef: randomUUID(),
          sedeCodigo: "SEDE-CENTRO",
          fecha: new Date().toISOString(),
          items: [
            { medicamentoCodigo: "MED-0001", cantidad: 10 },
            { medicamentoCodigo: "MED-0004", cantidad: 20 },
          ],
        }),
      }
    );

    const res = await postDispensacion(req, {
      params: Promise.resolve({ codigo: formula.codigo }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("CANTIDAD_EXCEDE_AUTORIZADA");
    validarContraContrato("ProblemDetail", body);

    // Verificar atomicidad: ninguno de los dos ítems cambió
    const itemsBd = await prisma.formulaItem.findMany({
      where: { formulaId: formula.id },
      orderBy: { medicamentoCodigo: "asc" },
    });
    expect(itemsBd[0].cantidadDispensada).toBe(0);
    expect(itemsBd[1].cantidadDispensada).toBe(50);
  });

  it("CA_EPS_06: repetición con la misma Idempotency-Key responde 200 sin duplicar", async () => {
    const formula = await crearFormulaPrueba({
      items: [{ medicamentoCodigo: "MED-0004", cantidadAutorizada: 60 }],
    });
    const idemKey = randomUUID();
    const payload = JSON.stringify({
      pedidoRef: randomUUID(),
      sedeCodigo: "SEDE-BELLO",
      fecha: new Date().toISOString(),
      items: [{ medicamentoCodigo: "MED-0004", cantidad: 15 }],
    });

    const makeReq = () =>
      new NextRequest(
        `http://localhost:3000/api/v1/formulas/${formula.codigo}/dispensaciones`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": API_KEY,
            "Idempotency-Key": idemKey,
          },
          body: payload,
        }
      );

    const res1 = await postDispensacion(makeReq(), {
      params: Promise.resolve({ codigo: formula.codigo }),
    });
    expect(res1.status).toBe(201);
    const body1 = await res1.json();

    const res2 = await postDispensacion(makeReq(), {
      params: Promise.resolve({ codigo: formula.codigo }),
    });
    expect(res2.status).toBe(200);
    const body2 = await res2.json();

    expect(body2).toEqual(body1);
    expect(body2.items[0].cantidadDispensada).toBe(15);
    validarContraContrato("FormulaResponse", body2);
  });

  it("CA_EPS_07: fórmula vencida por fecha se reporta VENCIDA y rechaza dispensación con 409", async () => {
    const formula = await crearFormulaPrueba({
      estado: "EMITIDA",
      diasVencimiento: -2,
    });

    // Consulta calcula VENCIDA sin job (RF-EPS-08)
    const reqGet = new NextRequest(
      `http://localhost:3000/api/v1/formulas/${formula.codigo}?documento=${pacienteDoc}`,
      { headers: { "X-API-Key": API_KEY } }
    );
    const resGet = await getFormula(reqGet, {
      params: Promise.resolve({ codigo: formula.codigo }),
    });
    expect(resGet.status).toBe(200);
    const bodyGet = await resGet.json();
    expect(bodyGet.estado).toBe("VENCIDA");
    validarContraContrato("FormulaResponse", bodyGet);

    // Intento de dispensar -> 409 FORMULA_NO_DISPENSABLE
    const reqPost = new NextRequest(
      `http://localhost:3000/api/v1/formulas/${formula.codigo}/dispensaciones`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
          "Idempotency-Key": randomUUID(),
        },
        body: JSON.stringify({
          pedidoRef: randomUUID(),
          sedeCodigo: "SEDE-CENTRO",
          fecha: new Date().toISOString(),
          items: [{ medicamentoCodigo: "MED-0004", cantidad: 10 }],
        }),
      }
    );
    const resPost = await postDispensacion(reqPost, {
      params: Promise.resolve({ codigo: formula.codigo }),
    });
    expect(resPost.status).toBe(409);
    const bodyPost = await resPost.json();
    expect(bodyPost.code).toBe("FORMULA_NO_DISPENSABLE");
    validarContraContrato("ProblemDetail", bodyPost);
  });

  it("RN-EPS-04: medicamento fuera de la fórmula responde 422 MEDICAMENTO_NO_EN_FORMULA", async () => {
    const formula = await crearFormulaPrueba({
      items: [{ medicamentoCodigo: "MED-0004", cantidadAutorizada: 30 }],
    });

    const req = new NextRequest(
      `http://localhost:3000/api/v1/formulas/${formula.codigo}/dispensaciones`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
          "Idempotency-Key": randomUUID(),
        },
        body: JSON.stringify({
          pedidoRef: randomUUID(),
          sedeCodigo: "SEDE-ITAGUI",
          fecha: new Date().toISOString(),
          items: [{ medicamentoCodigo: "MED-0001", cantidad: 5 }],
        }),
      }
    );

    const res = await postDispensacion(req, {
      params: Promise.resolve({ codigo: formula.codigo }),
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("MEDICAMENTO_NO_EN_FORMULA");
    validarContraContrato("ProblemDetail", body);
  });

  it("CA_EPS_08: acceso sin X-API-Key o con clave inválida devuelve 401", async () => {
    const reqSinKey = new NextRequest(
      "http://localhost:3000/api/v1/formulas/FRM-2026-000001?documento=1000000001"
    );
    const resSinKey = await getFormula(reqSinKey, {
      params: Promise.resolve({ codigo: "FRM-2026-000001" }),
    });
    expect(resSinKey.status).toBe(401);
    const bodySinKey = await resSinKey.json();
    expect(bodySinKey.code).toBe("API_KEY_INVALIDA");
    validarContraContrato("ProblemDetail", bodySinKey);

    const reqKeyInvalida = new NextRequest(
      "http://localhost:3000/api/v1/formulas/FRM-2026-000001/pdf?documento=1000000001",
      { headers: { "X-API-Key": "clave-incorrecta" } }
    );
    const resKeyInvalida = await getFormulaPdf(reqKeyInvalida, {
      params: Promise.resolve({ codigo: "FRM-2026-000001" }),
    });
    expect(resKeyInvalida.status).toBe(401);
  });

  it("CA_EPS_09: GET /api/v1/formulas/{codigo}/pdf responde 200 application/pdf válido", async () => {
    const formula = await crearFormulaPrueba();
    const req = new NextRequest(
      `http://localhost:3000/api/v1/formulas/${formula.codigo}/pdf?documento=${pacienteDoc}`,
      { headers: { "X-API-Key": API_KEY } }
    );
    const res = await getFormulaPdf(req, {
      params: Promise.resolve({ codigo: formula.codigo }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(500);
  });
});
