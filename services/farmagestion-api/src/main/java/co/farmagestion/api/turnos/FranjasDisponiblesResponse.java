package co.farmagestion.api.turnos;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record FranjasDisponiblesResponse(
		UUID sedeId,
		String sedeCodigo,
		String sedeNombre,
		LocalDate fecha,
		int duracionFranjaMin,
		int capacidadFranja,
		List<FranjaDisponibleItem> franjas) {

	public record FranjaDisponibleItem(
			LocalTime horaInicio,
			LocalTime horaFin,
			OffsetDateTime franjaInicio,
			int capacidad,
			int ocupados,
			int cuposDisponibles,
			boolean disponible) {
	}
}
