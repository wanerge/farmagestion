package co.farmagestion.api.pedidos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CancelarPedidoGestionRequest(
		@NotBlank(message = "El motivo de cancelación es obligatorio.")
		@Size(max = 500, message = "El motivo excede el máximo permitido.")
		String motivo) {
}
