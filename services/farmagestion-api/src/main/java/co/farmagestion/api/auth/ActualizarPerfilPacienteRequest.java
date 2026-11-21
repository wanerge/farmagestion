package co.farmagestion.api.auth;

import jakarta.validation.constraints.Size;

public record ActualizarPerfilPacienteRequest(
		@Size(max = 30, message = "El teléfono no puede superar 30 caracteres.")
		String telefono,

		String passwordActual,

		@Size(min = 8, max = 100, message = "La contraseña nueva debe tener entre 8 y 100 caracteres.")
		String passwordNueva) {
}
