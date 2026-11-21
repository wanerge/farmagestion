import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { FormulaResponseDto } from "./formula-service";

export const MARCA_SIMULADO = "DOCUMENTO SIMULADO — SIN VALIDEZ CLÍNICA";

export async function generarPdfFormula(
  formula: FormulaResponseDto,
  extras?: {
    eps?: string;
    medicoRegistro?: string;
    medicoEspecialidad?: string;
  }
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`Fórmula ${formula.codigo}`);
  pdfDoc.setSubject(MARCA_SIMULADO);

  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 45;
  const pageWidth = page.getWidth();
  let y = page.getHeight() - margin;

  // Marca de agua diagonal
  page.drawText(MARCA_SIMULADO, {
    x: 75,
    y: 260,
    size: 24,
    font: fontBold,
    color: rgb(0.92, 0.92, 0.92),
    rotate: degrees(38),
  });

  // Banner superior de advertencia
  page.drawRectangle({
    x: margin,
    y: y - 26,
    width: pageWidth - margin * 2,
    height: 26,
    color: rgb(0.99, 0.93, 0.8),
    borderColor: rgb(0.85, 0.55, 0.1),
    borderWidth: 1,
  });
  page.drawText(MARCA_SIMULADO, {
    x: margin + 75,
    y: y - 17,
    size: 11,
    font: fontBold,
    color: rgb(0.6, 0.25, 0.02),
  });
  y -= 48;

  // Encabezado
  page.drawText("FÓRMULA MÉDICA (SIMULADOR EPS)", {
    x: margin,
    y,
    size: 16,
    font: fontBold,
    color: rgb(0.08, 0.15, 0.25),
  });
  y -= 20;

  page.drawText(`Código: ${formula.codigo}`, {
    x: margin,
    y,
    size: 12,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  page.drawText(`Estado: ${formula.estado}`, {
    x: pageWidth - margin - 180,
    y,
    size: 11,
    font: fontBold,
    color: rgb(0.15, 0.35, 0.55),
  });
  y -= 16;

  page.drawText(
    `Fecha de emisión: ${formula.fechaEmision}    |    Vigencia hasta: ${formula.fechaVencimiento}`,
    {
      x: margin,
      y,
      size: 10,
      font: fontRegular,
      color: rgb(0.25, 0.25, 0.25),
    }
  );
  y -= 22;

  // Línea separadora
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: rgb(0.8, 0.83, 0.87),
  });
  y -= 18;

  // Datos del paciente
  page.drawText("DATOS DEL PACIENTE", {
    x: margin,
    y,
    size: 10,
    font: fontBold,
    color: rgb(0.2, 0.3, 0.45),
  });
  y -= 15;
  page.drawText(
    `Nombre: ${formula.paciente.nombres} ${formula.paciente.apellidos}`,
    { x: margin, y, size: 10, font: fontRegular }
  );
  y -= 14;
  page.drawText(
    `Documento: ${formula.paciente.tipoDocumento} ${formula.paciente.documento}${extras?.eps ? `    |    EPS: ${extras.eps}` : ""}`,
    { x: margin, y, size: 10, font: fontRegular }
  );
  y -= 22;

  // Datos del médico
  page.drawText("MÉDICO PRESCRIPTOR", {
    x: margin,
    y,
    size: 10,
    font: fontBold,
    color: rgb(0.2, 0.3, 0.45),
  });
  y -= 15;
  const medicoLinea = [
    formula.medico.nombre,
    extras?.medicoEspecialidad,
    extras?.medicoRegistro ? `Reg. ${extras.medicoRegistro}` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
  page.drawText(medicoLinea, { x: margin, y, size: 10, font: fontRegular });
  y -= 24;

  // Tabla de medicamentos
  page.drawText("MEDICAMENTOS PRESCRITOS", {
    x: margin,
    y,
    size: 10,
    font: fontBold,
    color: rgb(0.2, 0.3, 0.45),
  });
  y -= 16;

  // Cabecera de tabla
  page.drawRectangle({
    x: margin,
    y: y - 4,
    width: pageWidth - margin * 2,
    height: 18,
    color: rgb(0.93, 0.95, 0.98),
  });
  page.drawText("Código", { x: margin + 4, y: y + 1, size: 9, font: fontBold });
  page.drawText("Medicamento / Posología", {
    x: margin + 62,
    y: y + 1,
    size: 9,
    font: fontBold,
  });
  page.drawText("Aut.", { x: margin + 355, y: y + 1, size: 9, font: fontBold });
  page.drawText("Disp.", { x: margin + 400, y: y + 1, size: 9, font: fontBold });
  page.drawText("Saldo", { x: margin + 448, y: y + 1, size: 9, font: fontBold });
  y -= 20;

  for (const item of formula.items) {
    const saldo = item.cantidadAutorizada - item.cantidadDispensada;
    page.drawText(item.medicamentoCodigo, {
      x: margin + 4,
      y,
      size: 9,
      font: fontBold,
    });
    page.drawText(item.medicamentoNombre.slice(0, 46), {
      x: margin + 62,
      y,
      size: 9,
      font: fontBold,
    });
    page.drawText(String(item.cantidadAutorizada), {
      x: margin + 358,
      y,
      size: 9,
      font: fontRegular,
    });
    page.drawText(String(item.cantidadDispensada), {
      x: margin + 404,
      y,
      size: 9,
      font: fontRegular,
    });
    page.drawText(String(saldo), {
      x: margin + 452,
      y,
      size: 9,
      font: fontBold,
    });
    y -= 12;

    const posologia = `Dosis: ${item.dosis} · Frecuencia: ${item.frecuencia} · Duración: ${item.duracionDias} días`;
    page.drawText(posologia.slice(0, 75), {
      x: margin + 62,
      y,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.35, 0.35, 0.35),
    });
    y -= 14;

    page.drawLine({
      start: { x: margin, y: y + 4 },
      end: { x: pageWidth - margin, y: y + 4 },
      thickness: 0.5,
      color: rgb(0.88, 0.9, 0.92),
    });
    y -= 6;
  }

  if (formula.observaciones) {
    y -= 10;
    page.drawText("OBSERVACIONES", {
      x: margin,
      y,
      size: 10,
      font: fontBold,
      color: rgb(0.2, 0.3, 0.45),
    });
    y -= 14;
    page.drawText(formula.observaciones.slice(0, 95), {
      x: margin,
      y,
      size: 9.5,
      font: fontRegular,
    });
  }

  // Pie de página
  page.drawLine({
    start: { x: margin, y: 60 },
    end: { x: pageWidth - margin, y: 60 },
    thickness: 0.8,
    color: rgb(0.8, 0.83, 0.87),
  });
  page.drawText(
    `${MARCA_SIMULADO} · Proyecto académico FarmaGestión`,
    {
      x: margin,
      y: 44,
      size: 8.5,
      font: fontBold,
      color: rgb(0.45, 0.45, 0.45),
    }
  );

  return pdfDoc.save();
}
