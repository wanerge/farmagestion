package co.farmagestion.api.formulas;

import co.farmagestion.api.inventario.NivelDisponibilidad;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record FormulaResumenResponse(
		UUID id,
		String codigoExterno,
		EstadoFormulaExterna estadoExterno,
		LocalDate fechaEmision,
		LocalDate fechaVencimiento,
		boolean vigente,
		Instant sincronizadaEn,
		List<FormulaItemResumenResponse> items) {

	public record FormulaItemResumenResponse(
			UUID id,
			UUID medicamentoId,
			String medicamentoCodigo,
			String medicamentoNombre,
			String presentacion,
			int cantidadAutorizada,
			int cantidadDispensada,
			int cantidadReservadaActiva,
			int cantidadPendiente) {
	}

	public record DisponibilidadSedeItem(
			UUID sedeId,
			String sedeCodigo,
			String sedeNombre,
			NivelDisponibilidad nivel) {
	}
}
