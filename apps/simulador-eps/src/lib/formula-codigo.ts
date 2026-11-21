import type { Prisma, PrismaClient } from "@prisma/client";

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

export function obtenerHoyBogotaISO(referencia: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(referencia);
}

export async function generarCodigoFormula(
  db: PrismaExecutor,
  referencia: Date = new Date()
): Promise<string> {
  const anio = obtenerHoyBogotaISO(referencia).slice(0, 4);
  const rows = await db.$queryRaw<Array<{ nextval: bigint }>>`
    SELECT nextval('formula_codigo_seq') AS nextval
  `;
  const seq = Number(rows[0].nextval);
  return `FRM-${anio}-${String(seq).padStart(6, "0")}`;
}
