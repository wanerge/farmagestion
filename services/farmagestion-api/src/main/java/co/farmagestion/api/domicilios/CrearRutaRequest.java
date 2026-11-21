package co.farmagestion.api.domicilios;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

public record CrearRutaRequest(
		@NotNull(message = "Debe seleccionar un domiciliario.") UUID domiciliarioId,
		@NotEmpty(message = "Debe seleccionar al menos un pedido.") List<@NotNull UUID> pedidoIds) {
}
