package co.farmagestion.api.notificaciones;

import java.util.Collection;
import java.util.UUID;

/**
 * Puerto de salida para envío de notificaciones (00 §2 L5 y §4.2).
 * Permite agregar canales externos (correo, SMS) sin acoplar los módulos de negocio.
 */
public interface Notificador {

	void notificar(SolicitudNotificacion solicitud);

	default void notificarVarios(
			Collection<UUID> usuarioIds,
			String tipo,
			String titulo,
			String mensaje,
			String referenciaTipo,
			UUID referenciaId) {
		if (usuarioIds == null || usuarioIds.isEmpty()) {
			return;
		}
		for (UUID usuarioId : usuarioIds) {
			notificar(new SolicitudNotificacion(
					usuarioId, tipo, titulo, mensaje, referenciaTipo, referenciaId));
		}
	}
}
