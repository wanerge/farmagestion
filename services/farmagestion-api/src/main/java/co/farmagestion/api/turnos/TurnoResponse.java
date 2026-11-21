package co.farmagestion.api.turnos;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record TurnoResponse(
		UUID id,
		UUID pedidoId,
		UUID sedeId,
		LocalDate fecha,
		LocalTime franjaInicio,
		int numero,
		String codigo,
		EstadoTurno estado,
		Instant llamadoEn,
		Instant atendidoEn) {

	public static TurnoResponse from(Turno turno) {
		return new TurnoResponse(
				turno.getId(),
				turno.getPedidoId(),
				turno.getSedeId(),
				turno.getFecha(),
				turno.getFranjaInicio(),
				turno.getNumero(),
				turno.getCodigo(),
				turno.getEstado(),
				turno.getLlamadoEn(),
				turno.getAtendidoEn());
	}
}
