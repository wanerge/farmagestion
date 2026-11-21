package co.farmagestion.api.domicilios;

import java.util.UUID;

public record DomiciliarioResumenResponse(
		UUID usuarioId,
		String nombres,
		String apellidos) {
}
