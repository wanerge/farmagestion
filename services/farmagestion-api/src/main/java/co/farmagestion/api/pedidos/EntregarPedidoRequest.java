package co.farmagestion.api.pedidos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record EntregarPedidoRequest(
		@NotBlank(message = "El documento verificado del paciente es obligatorio.")
		@Size(max = 30, message = "El documento excede el máximo permitido.")
		String documentoVerificado,
		@Size(max = 500, message = "La nota excede el máximo permitido.")
		String nota) {
}
