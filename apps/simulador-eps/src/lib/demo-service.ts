import { obtenerHoyBogotaISO } from "./formula-codigo";
import { prisma } from "./prisma";

const PACIENTES_DEMO = [
  {
    tipoDocumento: "CC",
    documento: "1000000001",
    nombres: "Ana María",
    apellidos: "Velásquez",
    fechaNacimiento: new Date("1986-04-12T00:00:00Z"),
    eps: "Salud Antioquia EPS (Simulada)",
    telefono: "3001112201",
  },
  {
    tipoDocumento: "CC",
    documento: "1000000002",
    nombres: "Jorge Luis",
    apellidos: "Ramírez",
    fechaNacimiento: new Date("1978-09-23T00:00:00Z"),
    eps: "Nueva Salud EPS (Simulada)",
    telefono: "3001112202",
  },
  {
    tipoDocumento: "CC",
    documento: "1000000003",
    nombres: "Sofía",
    apellidos: "Giraldo",
    fechaNacimiento: new Date("1994-01-30T00:00:00Z"),
    eps: "Salud Antioquia EPS (Simulada)",
    telefono: "3001112203",
  },
  {
    tipoDocumento: "CC",
    documento: "1000000004",
    nombres: "Miguel",
    apellidos: "Arango",
    fechaNacimiento: new Date("1965-11-05T00:00:00Z"),
    eps: "Vida Plena EPS (Simulada)",
    telefono: "3001112204",
  },
  {
    tipoDocumento: "CC",
    documento: "1000000005",
    nombres: "Camila",
    apellidos: "Montoya",
    fechaNacimiento: new Date("1999-07-18T00:00:00Z"),
    eps: "Nueva Salud EPS (Simulada)",
    telefono: "3001112205",
  },
];

const MEDICOS_DEMO = [
  {
    nombre: "Dra. Claudia Patricia Morales",
    registro: "RM-SIM-10421",
    especialidad: "Medicina Interna",
  },
  {
    nombre: "Dr. Hernán Darío Saldarriaga",
    registro: "RM-SIM-20815",
    especialidad: "Medicina General",
  },
  {
    nombre: "Dra. Beatriz Elena Montoya",
    registro: "RM-SIM-31509",
    especialidad: "Cardiología",
  },
  {
    nombre: "Dr. Mauricio Alejandro Vélez",
    registro: "RM-SIM-42930",
    especialidad: "Endocrinología",
  },
];

function sumarDias(baseIso: string, dias: number): Date {
  const d = new Date(`${baseIso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d;
}

export async function cargarDatosDemo() {
  const hoyIso = obtenerHoyBogotaISO();
  const anio = hoyIso.slice(0, 4);

  const pacientesByDoc = new Map<string, string>();
  for (const p of PACIENTES_DEMO) {
    const saved = await prisma.pacienteEps.upsert({
      where: {
        tipoDocumento_documento: {
          tipoDocumento: p.tipoDocumento,
          documento: p.documento,
        },
      },
      update: {
        nombres: p.nombres,
        apellidos: p.apellidos,
        eps: p.eps,
        telefono: p.telefono,
      },
      create: p,
    });
    pacientesByDoc.set(p.documento, saved.id);
  }

  const medicosByReg = new Map<string, string>();
  for (const m of MEDICOS_DEMO) {
    const saved = await prisma.medico.upsert({
      where: { registro: m.registro },
      update: { nombre: m.nombre, especialidad: m.especialidad },
      create: m,
    });
    medicosByReg.set(m.registro, saved.id);
  }

  const formulasDemo = [
    {
      codigo: `FRM-${anio}-900001`,
      pacienteDoc: "1000000001",
      medicoReg: "RM-SIM-31509",
      diasEmision: 0,
      diasVencimiento: 30,
      estado: "EMITIDA",
      observaciones: "Control de hipertensión en 30 días.",
      items: [
        {
          medicamentoCodigo: "MED-0004",
          dosis: "1 tableta",
          frecuencia: "cada 12 horas",
          duracionDias: 30,
          cantidadAutorizada: 60,
          cantidadDispensada: 0,
        },
        {
          medicamentoCodigo: "MED-0007",
          dosis: "1 tableta",
          frecuencia: "cada 24 horas",
          duracionDias: 30,
          cantidadAutorizada: 30,
          cantidadDispensada: 0,
        },
      ],
    },
    {
      codigo: `FRM-${anio}-900002`,
      pacienteDoc: "1000000002",
      medicoReg: "RM-SIM-42930",
      diasEmision: -2,
      diasVencimiento: 28,
      estado: "EMITIDA",
      observaciones: "Control glucemia en ayunas.",
      items: [
        {
          medicamentoCodigo: "MED-0008",
          dosis: "1 tableta",
          frecuencia: "cada 12 horas con comidas",
          duracionDias: 30,
          cantidadAutorizada: 60,
          cantidadDispensada: 0,
        },
        {
          medicamentoCodigo: "MED-0010",
          dosis: "1 tableta",
          frecuencia: "en la noche",
          duracionDias: 30,
          cantidadAutorizada: 30,
          cantidadDispensada: 0,
        },
      ],
    },
    {
      codigo: `FRM-${anio}-900003`,
      pacienteDoc: "1000000003",
      medicoReg: "RM-SIM-20815",
      diasEmision: 0,
      diasVencimiento: 15,
      estado: "EMITIDA",
      observaciones: "Completar ciclo antibiótico.",
      items: [
        {
          medicamentoCodigo: "MED-0014",
          dosis: "1 cápsula",
          frecuencia: "cada 8 horas",
          duracionDias: 7,
          cantidadAutorizada: 21,
          cantidadDispensada: 0,
        },
        {
          medicamentoCodigo: "MED-0001",
          dosis: "1 tableta",
          frecuencia: "cada 8 horas si hay fiebre",
          duracionDias: 5,
          cantidadAutorizada: 15,
          cantidadDispensada: 0,
        },
      ],
    },
    {
      codigo: `FRM-${anio}-900004`,
      pacienteDoc: "1000000004",
      medicoReg: "RM-SIM-10421",
      diasEmision: -5,
      diasVencimiento: 25,
      estado: "EMITIDA",
      observaciones: "Incluye medicamento agotado en Sede Centro para prueba de parcial.",
      items: [
        {
          medicamentoCodigo: "MED-0005",
          dosis: "1 tableta",
          frecuencia: "cada 12 horas",
          duracionDias: 30,
          cantidadAutorizada: 60,
          cantidadDispensada: 0,
        },
        {
          medicamentoCodigo: "MED-0012",
          dosis: "1 cápsula",
          frecuencia: "en ayunas",
          duracionDias: 30,
          cantidadAutorizada: 30,
          cantidadDispensada: 0,
        },
      ],
    },
    {
      codigo: `FRM-${anio}-900005`,
      pacienteDoc: "1000000005",
      medicoReg: "RM-SIM-20815",
      diasEmision: -1,
      diasVencimiento: 29,
      estado: "EMITIDA",
      observaciones: "Manejo de rinitis alérgica.",
      items: [
        {
          medicamentoCodigo: "MED-0018",
          dosis: "1 tableta",
          frecuencia: "cada 24 horas",
          duracionDias: 10,
          cantidadAutorizada: 10,
          cantidadDispensada: 0,
        },
      ],
    },
    {
      codigo: `FRM-${anio}-900006`,
      pacienteDoc: "1000000001",
      medicoReg: "RM-SIM-10421",
      diasEmision: -28,
      diasVencimiento: 2,
      estado: "EMITIDA",
      observaciones: "Fórmula próxima a vencer (en 2 días).",
      items: [
        {
          medicamentoCodigo: "MED-0022",
          dosis: "1 tableta",
          frecuencia: "en ayunas",
          duracionDias: 30,
          cantidadAutorizada: 30,
          cantidadDispensada: 0,
        },
      ],
    },
    {
      codigo: `FRM-${anio}-900007`,
      pacienteDoc: "1000000002",
      medicoReg: "RM-SIM-20815",
      diasEmision: -40,
      diasVencimiento: -10,
      estado: "EMITIDA",
      observaciones: "Fórmula vencida por fecha para validar RF-EPS-08.",
      items: [
        {
          medicamentoCodigo: "MED-0002",
          dosis: "1 tableta",
          frecuencia: "cada 8 horas",
          duracionDias: 7,
          cantidadAutorizada: 20,
          cantidadDispensada: 0,
        },
      ],
    },
    {
      codigo: `FRM-${anio}-900008`,
      pacienteDoc: "1000000003",
      medicoReg: "RM-SIM-31509",
      diasEmision: -3,
      diasVencimiento: 27,
      estado: "PARCIALMENTE_DISPENSADA",
      observaciones: "Fórmula con entrega parcial previa.",
      items: [
        {
          medicamentoCodigo: "MED-0023",
          dosis: "1 tableta",
          frecuencia: "cada 24 horas",
          duracionDias: 30,
          cantidadAutorizada: 30,
          cantidadDispensada: 10,
        },
      ],
      dispensacionInicial: {
        pedidoRef: "DEMO-PED-0001",
        sedeCodigo: "SEDE-CENTRO",
        idempotencyKey: `demo-disp-${anio}-900008`,
        medicamentoCodigo: "MED-0023",
        cantidad: 10,
      },
    },
  ];

  let formulasCreadas = 0;
  for (const f of formulasDemo) {
    const yaExiste = await prisma.formula.findUnique({
      where: { codigo: f.codigo },
    });
    if (yaExiste) continue;

    const creada = await prisma.formula.create({
      data: {
        codigo: f.codigo,
        pacienteId: pacientesByDoc.get(f.pacienteDoc)!,
        medicoId: medicosByReg.get(f.medicoReg)!,
        fechaEmision: sumarDias(hoyIso, f.diasEmision),
        fechaVencimiento: sumarDias(hoyIso, f.diasVencimiento),
        estado: f.estado,
        observaciones: f.observaciones,
        items: {
          create: f.items,
        },
      },
    });

    if (f.dispensacionInicial) {
      await prisma.dispensacion.create({
        data: {
          formulaId: creada.id,
          pedidoRef: f.dispensacionInicial.pedidoRef,
          sedeCodigo: f.dispensacionInicial.sedeCodigo,
          idempotencyKey: f.dispensacionInicial.idempotencyKey,
          items: {
            create: [
              {
                medicamentoCodigo: f.dispensacionInicial.medicamentoCodigo,
                cantidad: f.dispensacionInicial.cantidad,
              },
            ],
          },
        },
      });
    }

    formulasCreadas += 1;
  }

  return {
    pacientes: PACIENTES_DEMO.length,
    medicos: MEDICOS_DEMO.length,
    formulasCreadas,
    formulasTotalesDemo: formulasDemo.length,
  };
}

export async function reiniciarDatosDemo() {
  await prisma.$transaction(async (tx) => {
    await tx.dispensacion.deleteMany();
    await tx.formula.deleteMany();
  });
  return cargarDatosDemo();
}
