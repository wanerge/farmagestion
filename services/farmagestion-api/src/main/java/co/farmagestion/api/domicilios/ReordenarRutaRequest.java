package co.farmagestion.api.domicilios;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

public record ReordenarRutaRequest(
		@NotEmpty(message = "Debe indicar el orden de las paradas.") List<@NotNull UUID> paradaIds) {
}
