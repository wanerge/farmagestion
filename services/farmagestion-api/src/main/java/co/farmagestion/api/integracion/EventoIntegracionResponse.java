package co.farmagestion.api.integracion;

import java.time.Instant;
import java.util.UUID;

public record EventoIntegracionResponse(
		UUID id,
		String tipo,
		String payload,
		EstadoEventoIntegracion estado,
		int intentos,
		String ultimoError,
		String idempotencyKey,
		Instant createdAt,
		Instant enviadoEn) {

	public static EventoIntegracionResponse from(EventoIntegracion evento) {
		return new EventoIntegracionResponse(
				evento.getId(),
				evento.getTipo(),
				evento.getPayload(),
				evento.getEstado(),
				evento.getIntentos(),
				evento.getUltimoError(),
				evento.getIdempotencyKey(),
				evento.getCreatedAt(),
				evento.getEnviadoEn());
	}
}
