package co.farmagestion.api.notificaciones;

import java.time.Instant;
import java.util.UUID;

public record NotificacionResponse(
		UUID id,
		String tipo,
		String titulo,
		String mensaje,
		String referenciaTipo,
		UUID referenciaId,
		boolean leida,
		Instant createdAt) {

	static NotificacionResponse from(Notificacion n) {
		return new NotificacionResponse(
				n.getId(),
				n.getTipo(),
				n.getTitulo(),
				n.getMensaje(),
				n.getReferenciaTipo(),
				n.getReferenciaId(),
				n.isLeida(),
				n.getCreatedAt());
	}
}
