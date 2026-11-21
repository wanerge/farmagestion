package co.farmagestion.api.domicilios;

import jakarta.validation.constraints.Size;

public record EntregarParadaRequest(
		@Size(max = 500) String nota) {
}
