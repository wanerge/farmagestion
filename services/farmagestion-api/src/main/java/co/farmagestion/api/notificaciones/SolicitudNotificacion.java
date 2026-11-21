package co.farmagestion.api.notificaciones;

import java.util.UUID;

public record SolicitudNotificacion(
		UUID usuarioId,
		String tipo,
		String titulo,
		String mensaje,
		String referenciaTipo,
		UUID referenciaId) {
}
