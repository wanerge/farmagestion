package co.farmagestion.api.pedidos;

import jakarta.validation.constraints.Size;

public record NotaOpcionalRequest(
		@Size(max = 500, message = "La nota excede el máximo permitido.")
		String nota) {
}
