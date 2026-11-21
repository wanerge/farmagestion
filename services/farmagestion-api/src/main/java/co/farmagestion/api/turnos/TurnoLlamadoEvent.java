package co.farmagestion.api.turnos;

import java.time.LocalTime;
import java.util.UUID;

public record TurnoLlamadoEvent(
		UUID turnoId,
		UUID pedidoId,
		UUID pacienteId,
		UUID sedeId,
		String codigoTurno,
		LocalTime franjaInicio) {
}
