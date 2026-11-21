package co.farmagestion.api.turnos;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/**
 * Respuesta pública de pantalla de sala sin datos personales (RF-EMP-18, CA-EMP-10).
 */
public record PantallaSalaResponse(
		String sedeCodigo,
		String sedeNombre,
		LocalDate fecha,
		List<TurnoSalaItem> llamados,
		List<TurnoSalaItem> enEspera) {

	public record TurnoSalaItem(
			String codigo,
			LocalTime franjaInicio,
			Instant llamadoEn) {
	}
}
