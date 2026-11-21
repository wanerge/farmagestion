import { inflateSync } from "node:zlib";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as postLogin } from "../login/route";
import { GET as getFormulas, POST as postFormula } from "../formulas/route";
import { POST as postAnular } from "../formulas/[id]/anular/route";
import { POST as postCargarDemo } from "../demo/cargar/route";
import { POST as postReiniciarDemo } from "../demo/reiniciar/route";
import { GET as getFormulaServicio } from "../../v1/formulas/[codigo]/route";
import { GET as getFormulaPdfServicio } from "../../v1/formulas/[codigo]/pdf/route";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME } from "@/lib/session";

const API_KEY = "test-api-key-simulador-eps";

function extraerTextoDeStreamsPdf(pdfBuffer: Buffer): string {
  const raw = pdfBuffer.toString("latin1");
  const textos: string[] = [];
  const regex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    const streamBytes = Buffer.from(match[1], "latin1");
    let decodificado = match[1];
    try {
      decodificado = inflateSync(streamBytes).toString("latin1");
    } catch {
      // stream sin compresión FlateDecode
    }
    textos.push(decodificado);
    // Decodificar cadenas hexadecimales <HEX> Tj emitidas por pdf-lib
    const hexRegex = /<([0-9A-Fa-f]+)>\s*Tj/g;
    let hexMatch: RegExpExecArray | null;
    while ((hexMatch = hexRegex.exec(decodificado)) !== null) {
      textos.push(Buffer.from(hexMatch[1], "hex").toString("latin1"));
    }
  }
  return textos.join("\n");
}

describe("Simulador EPS — Admin, emisión, PDF y demo (CA-EPS-01 y CA-EPS-09)", () => {
  let cookieHeader: string;
  let pacienteId: string;
  let medicoId: string;
  const pacienteDoc = "9008887776";
  const formulasCreadas: string[] = [];

  beforeAll(async () => {
    const loginReq = new NextRequest("http://localhost:3000/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "test-demo-password" }),
    });
    const loginRes = await postLogin(loginReq);
    expect(loginRes.status).toBe(200);
    const cookieVal = loginRes.cookies.get(SESSION_COOKIE_NAME)?.value;
    expect(cookieVal).toBeTruthy();
    cookieHeader = `${SESSION_COOKIE_NAME}=${cookieVal}`;

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
        nombres: "Laura",
        apellidos: "Prueba P4",
        fechaNacimiento: new Date("1992-03-10T00:00:00Z"),
        eps: "EPS Simulada",
        telefono: "3009998888",
      },
    });
    pacienteId = paciente.id;
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
    await prisma.pacienteEps.deleteMany({ where: { id: pacienteId } });
    await prisma.$disconnect();
  });

  it("CA_EPS_01: emitir fórmula con 2 ítems crea estado EMITIDA, código único, vigencia 30 días y aparece en listado", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/formulas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        pacienteId,
        medicoId,
        observaciones: "Prueba CA-EPS-01",
        items: [
          {
            medicamentoCodigo: "MED-0001",
            dosis: "1 tableta",
            frecuencia: "cada 8 horas",
            duracionDias: 5,
            cantidadAutorizada: 15,
          },
          {
            medicamentoCodigo: "MED-0004",
            dosis: "1 tableta",
            frecuencia: "cada 12 horas",
            duracionDias: 30,
            cantidadAutorizada: 60,
          },
        ],
      }),
    });

    const res = await postFormula(req);
    expect(res.status).toBe(201);
    const creada = await res.json();
    formulasCreadas.push(creada.id);

    expect(creada.estado).toBe("EMITIDA");
    expect(creada.codigo).toMatch(/^FRM-\d{4}-\d{6}$/);

    const diffDias =
      (new Date(creada.fechaVencimiento).getTime() -
        new Date(creada.fechaEmision).getTime()) /
      (1000 * 60 * 60 * 24);
    expect(diffDias).toBe(30);

    // Aparece en el listado
    const listReq = new NextRequest(
      `http://localhost:3000/api/admin/formulas?pacienteId=${pacienteId}`,
      { headers: { Cookie: cookieHeader } }
    );
    const listRes = await getFormulas(listReq);
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(
      listBody.items.some((f: { codigo: string }) => f.codigo === creada.codigo)
    ).toBe(true);

    // Se consulta por el API de servicio con X-API-Key
    const svcReq = new NextRequest(
      `http://localhost:3000/api/v1/formulas/${creada.codigo}?documento=${pacienteDoc}`,
      { headers: { "X-API-Key": API_KEY } }
    );
    const svcRes = await getFormulaServicio(svcReq, {
      params: Promise.resolve({ codigo: creada.codigo }),
    });
    expect(svcRes.status).toBe(200);
    const svcBody = await svcRes.json();
    expect(svcBody.items).toHaveLength(2);
  });

  it("CA_EPS_09: PDF contiene código, ítems y marca DOCUMENTO SIMULADO", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/formulas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        pacienteId,
        medicoId,
        items: [
          {
            medicamentoCodigo: "MED-0012",
            dosis: "1 cápsula",
            frecuencia: "en ayunas",
            duracionDias: 30,
            cantidadAutorizada: 30,
          },
        ],
      }),
    });
    const res = await postFormula(req);
    expect(res.status).toBe(201);
    const creada = await res.json();
    formulasCreadas.push(creada.id);

    const pdfReq = new NextRequest(
      `http://localhost:3000/api/v1/formulas/${creada.codigo}/pdf?documento=${pacienteDoc}`,
      { headers: { "X-API-Key": API_KEY } }
    );
    const pdfRes = await getFormulaPdfServicio(pdfReq, {
      params: Promise.resolve({ codigo: creada.codigo }),
    });

    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers.get("content-type")).toBe("application/pdf");

    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
    expect(pdfBuffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");

    const contenido = extraerTextoDeStreamsPdf(pdfBuffer);
    expect(contenido).toContain(creada.codigo);
    expect(contenido).toContain("MED-0012");
    expect(contenido).toContain("DOCUMENTO SIMULADO");
  });

  it("RF-EPS-06: anular fórmula en EMITIDA funciona y rechaza anular si ya está anulada", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/formulas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        pacienteId,
        medicoId,
        items: [
          {
            medicamentoCodigo: "MED-0002",
            dosis: "1 tableta",
            frecuencia: "cada 8 horas",
            duracionDias: 5,
            cantidadAutorizada: 15,
          },
        ],
      }),
    });
    const creada = await (await postFormula(req)).json();
    formulasCreadas.push(creada.id);

    const anularReq = new NextRequest(
      `http://localhost:3000/api/admin/formulas/${creada.id}/anular`,
      { method: "POST", headers: { Cookie: cookieHeader } }
    );
    const anularRes = await postAnular(anularReq, {
      params: Promise.resolve({ id: creada.id }),
    });
    expect(anularRes.status).toBe(200);
    expect((await anularRes.json()).estado).toBe("ANULADA");

    const segundoIntento = await postAnular(anularReq, {
      params: Promise.resolve({ id: creada.id }),
    });
    expect(segundoIntento.status).toBe(409);
  });

  it("RF-EPS-11 y RF-EPS-12: cargar y reiniciar datos demo es idempotente y crea 8 fórmulas", async () => {
    const reqReiniciar = new NextRequest(
      "http://localhost:3000/api/admin/demo/reiniciar",
      { method: "POST", headers: { Cookie: cookieHeader } }
    );
    const resReiniciar = await postReiniciarDemo(reqReiniciar);
    expect(resReiniciar.status).toBe(200);
    const bodyReiniciar = await resReiniciar.json();
    expect(bodyReiniciar.pacientes).toBe(5);
    expect(bodyReiniciar.medicos).toBe(4);
    expect(bodyReiniciar.formulasCreadas).toBe(8);

    // Repetir carga demo no duplica fórmulas
    const reqCargar = new NextRequest(
      "http://localhost:3000/api/admin/demo/cargar",
      { method: "POST", headers: { Cookie: cookieHeader } }
    );
    const resCargar = await postCargarDemo(reqCargar);
    expect(resCargar.status).toBe(200);
    const bodyCargar = await resCargar.json();
    expect(bodyCargar.formulasCreadas).toBe(0);
    expect(bodyCargar.formulasTotalesDemo).toBe(8);
  });
});
