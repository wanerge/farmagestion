import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface MedicamentoSeed {
  codigo: string;
  nombre: string;
  principioActivo: string;
  presentacion: string;
}

const MEDICOS_SEED = [
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

async function main() {
  const catalogoPath = path.resolve(
    process.cwd(),
    "../../data/seed/catalogo-medicamentos.json"
  );
  const medicamentos: MedicamentoSeed[] = JSON.parse(
    readFileSync(catalogoPath, "utf-8")
  );

  for (const med of medicamentos) {
    await prisma.medicamentoCatalogo.upsert({
      where: { codigo: med.codigo },
      update: {
        nombre: med.nombre,
        principioActivo: med.principioActivo,
        presentacion: med.presentacion,
      },
      create: {
        codigo: med.codigo,
        nombre: med.nombre,
        principioActivo: med.principioActivo,
        presentacion: med.presentacion,
      },
    });
  }

  for (const medico of MEDICOS_SEED) {
    await prisma.medico.upsert({
      where: { registro: medico.registro },
      update: {
        nombre: medico.nombre,
        especialidad: medico.especialidad,
      },
      create: medico,
    });
  }

  console.log(
    `Seed eps_db completado: ${medicamentos.length} medicamentos y ${MEDICOS_SEED.length} médicos.`
  );
}

main()
  .catch((err) => {
    console.error("Error ejecutando seed de eps_db:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
