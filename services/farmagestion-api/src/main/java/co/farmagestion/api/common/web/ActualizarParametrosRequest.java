package co.farmagestion.api.common.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record ActualizarParametrosRequest(
		@NotEmpty(message = "Debe enviar al menos un parámetro para actualizar.")
		List<@Valid ParametroValorItem> parametros) {

	public record ParametroValorItem(
			@NotBlank(message = "La clave del parámetro es obligatoria.")
			String clave,

			@NotBlank(message = "El valor del parámetro es obligatorio.")
			@Size(max = 255, message = "El valor no puede superar 255 caracteres.")
			String valor) {
	}
}
