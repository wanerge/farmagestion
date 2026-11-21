package co.farmagestion.api.inventario;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record AjusteStockRequest(
		@NotNull(message = "La cantidad es obligatoria.")
		Integer cantidad,

		@NotBlank(message = "El motivo es obligatorio para todo ajuste de inventario.")
		@Size(max = 500, message = "El motivo no puede superar 500 caracteres.")
		String motivo) {
}
