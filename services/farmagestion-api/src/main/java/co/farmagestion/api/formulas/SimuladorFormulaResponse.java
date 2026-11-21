package co.farmagestion.api.formulas;

import java.time.LocalDate;
import java.util.List;

public record SimuladorFormulaResponse(
		String codigo,
		EstadoFormulaExterna estado,
		LocalDate fechaEmision,
		LocalDate fechaVencimiento,
		String observaciones,
		SimuladorPacienteDto paciente,
		SimuladorMedicoDto medico,
		List<SimuladorFormulaItemDto> items) {

	public record SimuladorPacienteDto(
			String tipoDocumento,
			String documento,
			String nombres,
			String apellidos) {
	}

	public record SimuladorMedicoDto(String nombre) {
	}

	public record SimuladorFormulaItemDto(
			String medicamentoCodigo,
			String medicamentoNombre,
			String dosis,
			String frecuencia,
			int duracionDias,
			int cantidadAutorizada,
			int cantidadDispensada) {
	}
}
