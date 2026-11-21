package co.farmagestion.api.inventario;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record EntradaStockRequest(
		@NotNull(message = "La cantidad es obligatoria.")
		@Min(value = 1, message = "La cantidad debe ser al menos 1.")
		Integer cantidad,

		@Size(max = 500, message = "El motivo no puede superar 500 caracteres.")
		String motivo) {
}
