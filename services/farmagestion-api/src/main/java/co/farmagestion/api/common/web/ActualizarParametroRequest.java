package co.farmagestion.api.common.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ActualizarParametroRequest(
		@NotBlank(message = "El valor del parámetro es obligatorio.")
		@Size(max = 255, message = "El valor no puede superar 255 caracteres.")
		String valor) {
}
