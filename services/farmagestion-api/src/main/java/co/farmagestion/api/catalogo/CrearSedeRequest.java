package co.farmagestion.api.catalogo;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalTime;

public record CrearSedeRequest(
		@NotBlank(message = "El código de la sede es obligatorio.")
		@Size(max = 32, message = "El código no puede superar 32 caracteres.")
		String codigo,

		@NotBlank(message = "El nombre de la sede es obligatorio.")
		@Size(max = 150, message = "El nombre no puede superar 150 caracteres.")
		String nombre,

		@NotBlank(message = "La dirección es obligatoria.")
		@Size(max = 255, message = "La dirección no puede superar 255 caracteres.")
		String direccion,

		@NotNull(message = "La latitud es obligatoria.")
		@DecimalMin(value = "-90.0", message = "La latitud debe estar entre -90 y 90.")
		@DecimalMax(value = "90.0", message = "La latitud debe estar entre -90 y 90.")
		BigDecimal latitud,

		@NotNull(message = "La longitud es obligatoria.")
		@DecimalMin(value = "-180.0", message = "La longitud debe estar entre -180 y 180.")
		@DecimalMax(value = "180.0", message = "La longitud debe estar entre -180 y 180.")
		BigDecimal longitud,

		@NotNull(message = "La hora de apertura es obligatoria.")
		LocalTime horaApertura,

		@NotNull(message = "La hora de cierre es obligatoria.")
		LocalTime horaCierre,

		Boolean activa) {
}
