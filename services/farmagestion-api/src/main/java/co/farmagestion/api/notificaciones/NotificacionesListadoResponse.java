package co.farmagestion.api.notificaciones;

import java.util.List;

public record NotificacionesListadoResponse(
		List<NotificacionResponse> content,
		int page,
		int size,
		long totalElements,
		long noLeidas) {
}
