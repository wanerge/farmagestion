package co.farmagestion.api.integracion;

import java.util.UUID;

public record IntegracionErrorEvent(
		UUID eventoId,
		String tipo,
		String idempotencyKey,
		String ultimoError) {
}
