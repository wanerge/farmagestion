package co.farmagestion.api.formulas;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

public record FormulaRefSnapshot(
		UUID id,
		String codigoExterno,
		UUID pacienteId,
		EstadoFormulaExterna estadoExterno,
		LocalDate fechaEmision,
		LocalDate fechaVencimiento,
		Map<UUID, FormulaItemSnapshot> itemsPorMedicamento) {

	public record FormulaItemSnapshot(
			UUID medicamentoId,
			int cantidadAutorizada,
			int cantidadDispensada) {
	}
}
