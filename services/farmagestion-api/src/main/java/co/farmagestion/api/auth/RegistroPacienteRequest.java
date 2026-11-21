package co.farmagestion.api.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegistroPacienteRequest(
		@NotBlank(message = "El correo electrónico es obligatorio.")
		@Email(message = "El correo electrónico no tiene un formato válido.")
		@Size(max = 255)
		String email,

		@NotBlank(message = "La contraseña es obligatoria.")
		@Size(min = 8, max = 100, message = "La contraseña debe tener entre 8 y 100 caracteres.")
		String password,

		@NotBlank(message = "El tipo de documento es obligatorio.")
		@Size(max = 10)
		String tipoDocumento,

		@NotBlank(message = "El número de documento es obligatorio.")
		@Size(max = 30)
		String documento,

		@NotBlank(message = "Los nombres son obligatorios.")
		@Size(max = 120)
		String nombres,

		@NotBlank(message = "Los apellidos son obligatorios.")
		@Size(max = 120)
		String apellidos,

		@NotBlank(message = "El teléfono es obligatorio.")
		@Size(max = 30)
		String telefono) {
}
