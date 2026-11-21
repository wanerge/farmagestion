package co.farmagestion.api.catalogo;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ActualizarMedicamentoRequest(
		@NotBlank(message = "El código del medicamento es obligatorio.")
		@Size(max = 32, message = "El código no puede superar 32 caracteres.")
		String codigo,

		@NotBlank(message = "El nombre del medicamento es obligatorio.")
		@Size(max = 200, message = "El nombre no puede superar 200 caracteres.")
		String nombre,

		@NotBlank(message = "El principio activo es obligatorio.")
		@Size(max = 200, message = "El principio activo no puede superar 200 caracteres.")
		String principioActivo,

		@NotBlank(message = "La presentación es obligatoria.")
		@Size(max = 200, message = "La presentación no puede superar 200 caracteres.")
		String presentacion,

		@NotNull(message = "El estado activo es obligatorio.")
		Boolean activo) {
}
