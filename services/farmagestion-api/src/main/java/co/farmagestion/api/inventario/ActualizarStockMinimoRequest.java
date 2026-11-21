package co.farmagestion.api.inventario;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record ActualizarStockMinimoRequest(
		@NotNull(message = "El stock mínimo es obligatorio.")
		@Min(value = 0, message = "El stock mínimo no puede ser negativo.")
		Integer stockMinimo) {
}
