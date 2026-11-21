/**
 * Generación y descarga de tablas en formato CSV (RFC 4180 + BOM UTF-8 para Excel en español).
 * Cubre RF-EMP-29 y CA-EMP-14.
 */
export type CeldaCsv = string | number | boolean | null | undefined;

export function escaparCeldaCsv(valor: CeldaCsv): string {
  if (valor === null || valor === undefined) {
    return "";
  }
  const texto = String(valor);
  if (/[",\r\n]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

export function generarCsv(encabezados: string[], filas: CeldaCsv[][]): string {
  const lineas = [
    encabezados.map(escaparCeldaCsv).join(","),
    ...filas.map((fila) => fila.map(escaparCeldaCsv).join(",")),
  ];
  return `\uFEFF${lineas.join("\r\n")}\r\n`;
}

export function descargarCsv(
  nombreArchivo: string,
  encabezados: string[],
  filas: CeldaCsv[][]
): void {
  const contenido = generarCsv(encabezados, filas);
  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo.endsWith(".csv") ? nombreArchivo : `${nombreArchivo}.csv`;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}
