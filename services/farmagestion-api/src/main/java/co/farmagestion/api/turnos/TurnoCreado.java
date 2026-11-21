package co.farmagestion.api.turnos;

import java.time.Instant;

public record TurnoCreado(
		TurnoResponse turno,
		Instant expiraEn) {
}
