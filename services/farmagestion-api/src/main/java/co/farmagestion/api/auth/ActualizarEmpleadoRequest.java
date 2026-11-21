package co.farmagestion.api.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record ActualizarEmpleadoRequest(
		@NotBlank(message = "El correo electrónico es obligatorio.")
		@Email(message = "El correo electrónico no tiene un formato válido.")
		@Size(max = 255, message = "El correo no puede superar 255 caracteres.")
		String email,

		@Size(min = 8, max = 100, message = "La contraseña debe tener entre 8 y 100 caracteres.")
		String password,

		@NotNull(message = "El rol es obligatorio.")
		RolUsuario rol,

		@NotNull(message = "El cargo del empleado es obligatorio.")
		CargoEmpleado cargo,

		UUID sedeId,

		@NotBlank(message = "Los nombres son obligatorios.")
		@Size(max = 120, message = "Los nombres no pueden superar 120 caracteres.")
		String nombres,

		@NotBlank(message = "Los apellidos son obligatorios.")
		@Size(max = 120, message = "Los apellidos no pueden superar 120 caracteres.")
		String apellidos,

		@NotNull(message = "El estado activo es obligatorio.")
		Boolean activo) {
}
