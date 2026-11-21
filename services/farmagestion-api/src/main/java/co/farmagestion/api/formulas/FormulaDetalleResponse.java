package co.farmagestion.api.formulas;

import co.farmagestion.api.formulas.FormulaResumenResponse.DisponibilidadSedeItem;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record FormulaDetalleResponse(
		UUID id,
		String codigoExterno,
		EstadoFormulaExterna estadoExterno,
		LocalDate fechaEmision,
		LocalDate fechaVencimiento,
		boolean vigente,
		String observaciones,
		String medicoNombre,
		Instant sincronizadaEn,
		List<FormulaItemDetalleResponse> items) {

	public record FormulaItemDetalleResponse(
			UUID id,
			UUID medicamentoId,
			String medicamentoCodigo,
			String medicamentoNombre,
			String principioActivo,
			String presentacion,
			String dosis,
			String frecuencia,
			Integer duracionDias,
			int cantidadAutorizada,
			int cantidadDispensada,
			int cantidadReservadaActiva,
			int cantidadPendiente,
			List<DisponibilidadSedeItem> disponibilidadPorSede) {
	}
}
